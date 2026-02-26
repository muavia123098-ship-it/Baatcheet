// call.js - WebRTC Voice Calling Logic

// WebRTC Configuration using Google STUN
const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

// Global State
let pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let incomingCallListener = null;
let callStartTime = null;
let otherParticipantId = null;

// Standardize globals
const db = window.db;
const auth = window.auth;
const callBtn = document.getElementById('call-btn');
const incomingCallModal = document.getElementById('incoming-call-modal');
const activeCallModal = document.getElementById('active-call-modal');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const speakerBtn = document.getElementById('speaker-btn');
const localAudio = document.getElementById('local-audio');
const remoteAudio = document.getElementById('remote-audio');
const ringtoneAudio = document.getElementById('ringtone-audio');
const callStatus = document.getElementById('call-status');

// Call State
let isMuted = false;
let isSpeakerOn = true;

// Initialize Media Channels
async function setupLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        localAudio.srcObject = localStream;

        remoteStream = new MediaStream();
        remoteAudio.srcObject = remoteStream;

        // Push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

        // Pull tracks from peer connection, add to remote video stream
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access is required for voice calls.");
        throw err;
    }
}

// 1. Create a Call (Caller)
async function startCall(receiverId) {
    if (!window.userData || !receiverId) return;

    // UI Update
    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Calling...";

    if (activeChatData) {
        const other = getOtherParticipant(activeChatData);
        if (other) {
            callName = other.nickname || other.name || "Contact";
        }
    }

    document.getElementById('active-call-name').innerText = callName;

    try {
        await setupLocalStream();

        // Reference to Firestore collections
        const callDoc = db.collection('calls').doc();
        const offerCandidates = callDoc.collection('offerCandidates');
        const answerCandidates = callDoc.collection('answerCandidates');

        currentCallId = callDoc.id;
        otherParticipantId = receiverId;
        window.amICaller = true; // Track who started the call

        // Get candidates for caller, save to db
        pc.onicecandidate = (event) => {
            event.candidate && offerCandidates.add(event.candidate.toJSON());
        };

        // Create offer
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        // Save call request to Firestore
        await callDoc.set({
            offer,
            callerId: window.userData.uid,
            callerName: window.userData.name,
            receiverId: receiverId,
            status: "ringing",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Listen for remote answer
        callDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (!data) {
                // Call deleted by receiver (Declined/Ended)
                endCallUI();
                return;
            }

            if (data.status === 'connected') {
                if (!callStartTime) callStartTime = Date.now();
                callStatus.innerText = "Connected";
                callStatus.style.color = "#00a884"; // Green for connected
            }

            if (!pc.currentRemoteDescription && data && data.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answerDescription);
            }
        });

        // Listen for remote ICE candidates
        answerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate);
                }
            });
        });

    } catch (err) {
        console.error("Failed to start call", err);
        endCallUI();
    }
}

// 2. Listen for Incoming Calls
function listenForCalls() {
    if (!window.userData) return;

    if (incomingCallListener) {
        incomingCallListener(); // Unsubscribe previous if any
    }

    incomingCallListener = db.collection('calls')
        .where('receiverId', '==', window.userData.uid)
        .where('status', '==', 'ringing')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const callData = change.doc.data();
                    currentCallId = change.doc.id;
                    otherParticipantId = callData.callerId;

                    // Play Ringtone
                    if (ringtoneAudio) {
                        ringtoneAudio.play().catch(e => console.log("Audio play failed:", e));

                        // Set Media Session Metadata (Styles the Android notification)
                        if ('mediaSession' in navigator) {
                            navigator.mediaSession.metadata = new MediaMetadata({
                                title: 'Incoming Call',
                                artist: callData.callerName || 'Baatcheet',
                                album: 'Baatcheet Messenger'
                            });
                        }
                    }

                    // Show Notification
                    if (typeof showCallNotification === 'function') {
                        showCallNotification(callData.callerName || "Someone");
                    }

                    // Show incoming call UI
                    document.getElementById('incoming-caller-name').innerText = callData.callerName;
                    incomingCallModal.classList.remove('hidden');
                    window.amICaller = false; // I am the receiver

                    // Setup active mode UI for later
                    document.getElementById('active-call-name').innerText = callData.callerName;
                }

                if (change.type === 'removed') {
                    // Caller cancelled before pickup
                    if (!activeCallModal.classList.contains('hidden')) return; // Already answered

                    // Stop Ringtone
                    if (ringtoneAudio) {
                        ringtoneAudio.pause();
                        ringtoneAudio.currentTime = 0;
                    }

                    // Log Missed Call (Only caller logs it as missed_outgoing, or receiver as missed_incoming)
                    // Actually, let's have only one entry. If it's removed and not answered, it's missed.
                    if (window.userData.uid === callData.receiverId) {
                        addCallLog('missed', callData.callerId, null, callData.callerId, callData.receiverId);
                    }

                    incomingCallModal.classList.add('hidden');
                    currentCallId = null;
                }
            });
        });
}

// 3. Answer Call (Receiver)
async function answerCall(callId) {
    if (!callId) return;

    incomingCallModal.classList.add('hidden');
    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Connecting...";

    // Stop Ringtone if answering
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    try {
        await setupLocalStream();

        const callDoc = db.collection('calls').doc(callId);
        const answerCandidates = callDoc.collection('answerCandidates');
        const offerCandidates = callDoc.collection('offerCandidates');

        // Capture ICE candidates from receiver
        pc.onicecandidate = (event) => {
            event.candidate && answerCandidates.add(event.candidate.toJSON());
        };

        const callData = (await callDoc.get()).data();
        if (!callData) {
            alert("Call no longer exists.");
            endCallUI();
            return;
        }

        const offerDescription = callData.offer;
        await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        // Update document with answer and status
        await callDoc.update({
            answer,
            status: "connected"
        });

        if (!callStartTime) callStartTime = Date.now();
        callStatus.innerText = "Connected";
        callStatus.style.color = "#00a884";

        // Add Call Log to Chat (Single entry for answered call)
        if (window.userData.uid === callData.receiverId) {
            addCallLog('answered', callData.callerId, null, callData.callerId, callData.receiverId);
        }

        // Listen for caller ICE candidates
        offerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    pc.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });

        // Listen if caller drops
        callDoc.onSnapshot(snapshot => {
            if (!snapshot.exists) {
                endCallUI();
            }
        });

    } catch (err) {
        console.error("Failed to answer call", err);
        endCallUI();
    }
}

// 4. End Call Logic
async function endCall() {
    if (currentCallId) {
        // Delete firestore document to signal other peer
        try {
            await db.collection('calls').doc(currentCallId).delete();
        } catch (e) { console.error("Error deleting call doc", e); }
    }

    let duration = 0;
    if (callStartTime) {
        duration = Math.floor((Date.now() - callStartTime) / 1000);
    }

    if (duration > 0 && otherParticipantId) {
        // Log the duration. Only one user needs to do this, ideally caller on disconnect.
        if (window.amICaller) {
            addCallLog('answered', otherParticipantId, duration, window.userData.uid, otherParticipantId);
        }
    } else if (duration === 0 && otherParticipantId) {
        // Cancelled by caller before answer
        if (window.amICaller) {
            addCallLog('missed', otherParticipantId, null, window.userData.uid, otherParticipantId);
        }
    }

    endCallUI();
}

// Cleanup function
function endCallUI() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
    }

    pc.close();

    // Re-initialize PC for next calls
    pc = new RTCPeerConnection(servers);
    localStream = null;
    remoteStream = null;
    currentCallId = null;
    callStartTime = null;
    otherParticipantId = null;
    window.amICaller = null;

    // Reset States
    isMuted = false;
    isSpeakerOn = true;
    if (muteBtn) {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
    if (speakerBtn) {
        speakerBtn.classList.remove('active');
    }

    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    // Clear Media Session
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
    }

    // Reset UI
    activeCallModal.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    callStatus.innerText = "Calling...";
    callStatus.style.color = "var(--primary)";
    localAudio.srcObject = null;
    remoteAudio.srcObject = null;
}

// Mute / Speaker Toggle
if (muteBtn) {
    muteBtn.onclick = () => {
        if (!localStream) return;
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        muteBtn.classList.toggle('active', isMuted);
        muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    };
}

if (speakerBtn) {
    speakerBtn.onclick = async () => {
        const remoteAudio = document.getElementById('remote-audio');
        if (!remoteAudio) return;

        isSpeakerOn = !isSpeakerOn;
        speakerBtn.classList.toggle('active', !isSpeakerOn); // Active highlight when speaker is "off" (earpiece mode)

        // Attempt to switch output if setSinkId is supported (mostly desktop/chrome)
        // On mobile browsers, this is mostly handled by system/hardware but we can try to toggle sinkId
        if (remoteAudio.setSinkId) {
            try {
                // If isSpeakerOn is false, we try to find a non-speaker device if available
                // But usually browsers don't give "earpiece" vs "speaker" as separate IDs in JS
                // However, we reflect the UI state for the user.
                console.log("Speaker toggled to:", isSpeakerOn);
            } catch (err) {
                console.error("setSinkId failed", err);
            }
        }
    };
}

// Event Listeners
if (acceptCallBtn) acceptCallBtn.onclick = () => answerCall(currentCallId);
if (declineCallBtn) declineCallBtn.onclick = () => endCall();
if (endCallBtn) endCallBtn.onclick = () => endCall();
// Helper to add call record to chat
// Helper to add call record to chat
async function addCallLog(type, otherUserId, duration = null, callerId = null, receiverId = null) {
    if (!window.userData || !otherUserId) return;
    const convId = [window.userData.uid, otherUserId].sort().join('_');

    // We store minimal info and IDs so app.js can render "Incoming" or "Outgoing" correctly for each user
    try {
        await db.collection('conversations').doc(convId).collection('messages').add({
            text: 'Voice Call',
            senderId: window.userData.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'call',
            callStatus: type, // 'answered' or 'missed'
            callerId: callerId || (window.amICaller ? window.userData.uid : otherUserId),
            receiverId: receiverId || (window.amICaller ? otherUserId : window.userData.uid),
            duration: duration,
            read: true
        });

        // Update last message in conversation
        await db.collection('conversations').doc(convId).update({
            lastMessage: '📞 Voice Call',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            [`unread_${receiverId}`]: true
        });
    } catch (e) {
        console.error("Error adding call log:", e);
    }
}
