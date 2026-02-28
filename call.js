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
let currentCallId = null;
let callName = "";
let isVideoCall = false;
let isCameraOn = true;

// Standardize globals
const db = window.db;
const auth = window.auth;
const callBtn = document.getElementById('call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const cameraBtn = document.getElementById('camera-btn');
const incomingCallModal = document.getElementById('incoming-call-modal');
const activeCallModal = document.getElementById('active-call-modal');
const videoContainer = document.getElementById('video-container');
const callHeaderUI = document.getElementById('call-header-ui');

const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const muteBtn = document.getElementById('mute-btn');
const speakerBtn = document.getElementById('speaker-btn');
const localAudio = document.getElementById('local-audio');
const remoteAudio = document.getElementById('remote-audio');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const ringtoneAudio = document.getElementById('ringtone-audio');
const callStatus = document.getElementById('call-status');

// Initialize Media Channels
async function setupLocalStream(withVideo = false) {
    try {
        console.log(`Setting up local stream... requesting ${withVideo ? 'video & ' : ''}microphone access`);
        const constraints = {
            video: withVideo ? { facingMode: 'user' } : false,
            audio: { echoCancellation: true, noiseSuppression: true }
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Media access granted. Stream ID:", localStream.id);

        if (withVideo) {
            localVideo.srcObject = localStream;
            videoContainer.style.display = 'block';
            callHeaderUI.classList.add('wa-call-header-video');
            cameraBtn.style.display = 'flex';
        } else {
            localAudio.srcObject = localStream;
            videoContainer.style.display = 'none';
            callHeaderUI.classList.remove('wa-call-header-video');
            cameraBtn.style.display = 'none';
        }

        // Reset PeerConnection listeners but NOT the object itself
        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') {
                callStatus.innerText = "Connected";
                callStatus.style.color = "#00a884";
                remoteAudio.play().catch(e => console.warn("Remote audio play failed:", e));
            }
        };

        pc.ontrack = (event) => {
            console.log("Remote track received:", event.track.kind);
            if (event.track.kind === 'video') {
                remoteVideo.srcObject = event.streams[0];
            } else {
                remoteAudio.srcObject = event.streams[0];
            }
        };

        // Push tracks to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

    } catch (err) {
        console.error("Error accessing media:", err);
        throw err;
    }
}

// 1. Create a Call (Caller)
async function startCall(receiverId, withVideo = false) {
    if (!window.userData || !receiverId) return;
    isVideoCall = withVideo;

    // Block Check
    if (window.activeChatData && window.activeChatData.blockedBy) {
        const blockerIds = Object.keys(window.activeChatData.blockedBy);
        if (blockerIds.length > 0) {
            alert("This chat is blocked. You cannot make calls.");
            return;
        }
    }

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
        console.log("Starting call to:", receiverId, "Video:", withVideo);
        await setupLocalStream(withVideo);

        // Reference to Firestore collections
        const callDoc = db.collection('calls').doc();
        const offerCandidates = callDoc.collection('offerCandidates');
        const answerCandidates = callDoc.collection('answerCandidates');

        currentCallId = callDoc.id;
        otherParticipantId = receiverId;
        window.amICaller = true;

        pc.onicecandidate = (event) => {
            event.candidate && offerCandidates.add(event.candidate.toJSON());
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await callDoc.set({
            offer,
            callerId: window.userData.uid,
            callerName: window.userData.name,
            receiverId: receiverId,
            status: "ringing",
            isVideo: isVideoCall,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Listen for remote answer
        callDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (!data) {
                endCallUI();
                return;
            }

            if (!pc.currentRemoteDescription && data.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.setRemoteDescription(answerDescription).catch(e => console.error("Error setting remote description:", e));
            }
        });

        // Listen for remote ICE candidates
        answerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.addIceCandidate(candidate).catch(e => console.warn("Error adding answer candidate:", e));
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
        incomingCallListener();
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
                    isVideoCall = callData.isVideo || false;

                    if (ringtoneAudio) {
                        ringtoneAudio.play().catch(e => console.log("Audio play failed:", e));
                    }

                    document.getElementById('incoming-caller-name').innerText = callData.callerName;
                    document.querySelector('.wa-call-status').innerText = isVideoCall ? "Incoming Video Call" : "Incoming Voice Call";
                    incomingCallModal.classList.remove('hidden');
                    window.amICaller = false;

                    document.getElementById('active-call-name').innerText = callData.callerName;
                }

                if (change.type === 'removed') {
                    if (!activeCallModal.classList.contains('hidden')) return;
                    if (ringtoneAudio) {
                        ringtoneAudio.pause();
                        ringtoneAudio.currentTime = 0;
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

    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    try {
        console.log("Answering call, Call ID:", callId, "Video:", isVideoCall);
        await setupLocalStream(isVideoCall);

        const callDoc = db.collection('calls').doc(callId);
        const answerCandidates = callDoc.collection('answerCandidates');
        const offerCandidates = callDoc.collection('offerCandidates');

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

        await callDoc.update({
            answer,
            status: "connected"
        });

        if (!callStartTime) callStartTime = Date.now();
        callStatus.innerText = "Connected";
        callStatus.style.color = "#00a884";

        offerCandidates.onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    pc.addIceCandidate(new RTCIceCandidate(data)).catch(e => console.warn("Error adding offer candidate:", e));
                }
            });
        });

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
        try {
            await db.collection('calls').doc(currentCallId).delete();
        } catch (e) { console.error("Error deleting call doc", e); }
    }

    let duration = 0;
    if (callStartTime) {
        duration = Math.floor((Date.now() - callStartTime) / 1000);
    }

    if (duration > 0 && otherParticipantId) {
        if (window.amICaller) {
            addCallLog('answered', otherParticipantId, duration, window.userData.uid, otherParticipantId);
        }
    } else if (duration === 0 && otherParticipantId) {
        if (window.amICaller) {
            addCallLog('missed', otherParticipantId, null, window.userData.uid, otherParticipantId);
        }
    }

    endCallUI();
}

function endCallUI() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (pc) {
        try { pc.close(); } catch (e) { }
    }

    pc = new RTCPeerConnection(servers);
    localStream = null;
    remoteStream = null;
    currentCallId = null;
    callStartTime = null;
    otherParticipantId = null;
    window.amICaller = null;
    isVideoCall = false;

    isMuted = false;
    isCameraOn = true;
    if (muteBtn) {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
    if (cameraBtn) {
        cameraBtn.classList.remove('active');
        cameraBtn.style.display = 'none';
        cameraBtn.innerHTML = '<i class="fas fa-video"></i>';
    }

    if (videoContainer) videoContainer.style.display = 'none';
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    activeCallModal.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    callStatus.innerText = "Calling...";
    callStatus.style.color = "var(--primary)";
}

// Handlers
if (muteBtn) {
    muteBtn.onclick = () => {
        if (!localStream) return;
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
        muteBtn.classList.toggle('active', isMuted);
        muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    };
}

if (cameraBtn) {
    cameraBtn.onclick = () => {
        if (!localStream) return;
        isCameraOn = !isCameraOn;
        localStream.getVideoTracks().forEach(track => track.enabled = isCameraOn);
        cameraBtn.classList.toggle('active', !isCameraOn);
        cameraBtn.innerHTML = isCameraOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    };
}

if (acceptCallBtn) acceptCallBtn.onclick = () => answerCall(currentCallId);
if (declineCallBtn) declineCallBtn.onclick = endCall;
if (endCallBtn) endCallBtn.onclick = endCall;

async function addCallLog(type, otherUserId, duration = null, callerId = null, receiverId = null) {
    if (!window.userData || !otherUserId) return;
    const convId = [window.userData.uid, otherUserId].sort().join('_');

    try {
        await db.collection('conversations').doc(convId).collection('messages').add({
            text: isVideoCall ? 'Video Call' : 'Voice Call',
            senderId: window.userData.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'call',
            callStatus: type,
            callerId: callerId || (window.amICaller ? window.userData.uid : otherUserId),
            receiverId: receiverId || (window.amICaller ? otherUserId : window.userData.uid),
            duration: duration,
            isVideo: isVideoCall,
            read: true,
            expiryAt: Date.now() + (60 * 60 * 1000)
        });

        await db.collection('conversations').doc(convId).update({
            lastMessage: isVideoCall ? '📹 Video Call' : '📞 Voice Call',
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            [`unread_${receiverId}`]: true
        });
    } catch (e) {
        console.error("Error adding call log:", e);
    }
}
