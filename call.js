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
let currentCallId = null;
let incomingCallListener = null;

// DOM Elements
const callBtn = document.getElementById('call-btn');
const incomingCallModal = document.getElementById('incoming-call-modal');
const activeCallModal = document.getElementById('active-call-modal');
const acceptCallBtn = document.getElementById('accept-call-btn');
const declineCallBtn = document.getElementById('decline-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const localAudio = document.getElementById('local-audio');
const remoteAudio = document.getElementById('remote-audio');
const callStatus = document.getElementById('call-status');

// Initialize Media Channels
async function setupLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
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
    if (!userData || !receiverId) return;

    // UI Update
    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Calling...";
    document.getElementById('active-call-name').innerText = activeChatData ? activeChatData.name : "Contact";
    document.getElementById('active-call-img').src = activeChatData ? activeChatData.photo : "https://ui-avatars.com/api/?name=User&background=202c33&color=fff";

    try {
        await setupLocalStream();

        // Reference to Firestore collections
        const callDoc = db.collection('calls').doc();
        const offerCandidates = callDoc.collection('offerCandidates');
        const answerCandidates = callDoc.collection('answerCandidates');

        currentCallId = callDoc.id;

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
            callerId: userData.uid,
            callerName: userData.name,
            callerPhoto: userData.photoURL || `https://ui-avatars.com/api/?name=${userData.name}&background=d32f2f&color=fff`,
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
    if (!userData) return;

    if (incomingCallListener) {
        incomingCallListener(); // Unsubscribe previous if any
    }

    incomingCallListener = db.collection('calls')
        .where('receiverId', '==', userData.uid)
        .where('status', '==', 'ringing')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const callData = change.doc.data();
                    currentCallId = change.doc.id;

                    // Show incoming call UI
                    document.getElementById('incoming-caller-name').innerText = callData.callerName;
                    document.getElementById('incoming-caller-img').src = callData.callerPhoto;
                    incomingCallModal.classList.remove('hidden');

                    // Setup active mode UI for later
                    document.getElementById('active-call-name').innerText = callData.callerName;
                    document.getElementById('active-call-img').src = callData.callerPhoto;
                }

                if (change.type === 'removed') {
                    // Caller cancelled before pickup
                    if (!activeCallModal.classList.contains('hidden')) return; // Already answered
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

        callStatus.innerText = "Connected";
        callStatus.style.color = "#00a884";

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

    // Reset UI
    activeCallModal.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    callStatus.innerText = "Calling...";
    callStatus.style.color = "var(--primary)";
    localAudio.srcObject = null;
    remoteAudio.srcObject = null;
}

// Event Listeners
if (acceptCallBtn) acceptCallBtn.onclick = () => answerCall(currentCallId);
if (declineCallBtn) declineCallBtn.onclick = () => endCall();
if (endCallBtn) endCallBtn.onclick = () => endCall();

// Bind Call Button (if in chat room)
if (callBtn) {
    callBtn.onclick = () => {
        if (activeChatData && activeChatData.otherUserId) {
            startCall(activeChatData.otherUserId);
        }
    }
}
