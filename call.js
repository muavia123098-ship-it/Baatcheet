// call.js - WebRTC Voice & Video Calling Logic

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
let currentCallListener = null; // Unsubscribe for call doc
let candidateListener = null; // Unsubscribe for candidates
let callStartTime = null;
let otherParticipantId = null;
let currentCallId = null;
let callName = "";
let isVideoCall = false;
let isCameraOn = true;
let isMuted = false;

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

// Helper to unsubscribe listeners
function clearCallListeners() {
    console.log("[clearCallListeners] Cleaning up observers...");
    if (currentCallListener) {
        currentCallListener();
        currentCallListener = null;
    }
    if (candidateListener) {
        candidateListener();
        candidateListener = null;
    }
}

// Initialize Media Channels
async function setupLocalStream(withVideo = false) {
    try {
        console.log(`[setupLocalStream] Requesting ${withVideo ? 'Video+Audio' : 'Audio Only'}`);
        const constraints = {
            video: withVideo ? { facingMode: 'user' } : false,
            audio: { echoCancellation: true, noiseSuppression: true }
        };

        // If localStream already exists, stop it first to refresh or reuse
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("[setupLocalStream] Permission granted. Stream ID:", localStream.id);

        if (withVideo) {
            if (localVideo) localVideo.srcObject = localStream;
            if (videoContainer) videoContainer.style.display = 'block';
            if (callHeaderUI) callHeaderUI.classList.add('wa-call-header-video');
            if (cameraBtn) cameraBtn.style.display = 'flex';
        } else {
            if (localAudio) localAudio.srcObject = localStream;
            if (videoContainer) videoContainer.style.display = 'none';
            if (callHeaderUI) callHeaderUI.classList.remove('wa-call-header-video');
            if (cameraBtn) cameraBtn.style.display = 'none';
        }

        // Monitoring ICE
        pc.oniceconnectionstatechange = () => {
            console.log("[ICE State]:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') {
                callStatus.innerText = "Connected";
                callStatus.style.color = "#00a884";
                if (remoteAudio) remoteAudio.play().catch(e => console.warn("Auto-play fail:", e));
            }
        };

        pc.ontrack = (event) => {
            console.log("[Track Received]:", event.track.kind);
            if (event.track.kind === 'video') {
                if (remoteVideo) remoteVideo.srcObject = event.streams[0];
            } else {
                if (remoteAudio) remoteAudio.srcObject = event.streams[0];
            }
        };

        // Add Tracks
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

    } catch (err) {
        console.error("[setupLocalStream] FATAL ERROR:", err);
        throw err;
    }
}

// 1. Create a Call (Caller)
async function startCall(receiverId, withVideo = false) {
    if (!window.userData || !receiverId) return;

    // Safety: don't start if already in a call
    if (currentCallId && !activeCallModal.classList.contains('hidden')) {
        console.warn("Already in a call session.");
        return;
    }

    isVideoCall = withVideo;
    clearCallListeners();

    // UI Update
    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Calling...";

    if (activeChatData) {
        const other = getOtherParticipant(activeChatData);
        if (other) callName = other.nickname || other.name || "Contact";
    }
    document.getElementById('active-call-name').innerText = callName;

    try {
        console.log(`[startCall] Initiating... Target: ${receiverId}, Video: ${withVideo}`);
        await setupLocalStream(withVideo);

        const callDoc = db.collection('calls').doc();
        currentCallId = callDoc.id;
        otherParticipantId = receiverId;
        window.amICaller = true;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                callDoc.collection('offerCandidates').add(event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = { sdp: offerDescription.sdp, type: offerDescription.type };

        await callDoc.set({
            offer,
            callerId: window.userData.uid,
            callerName: window.userData.name,
            receiverId: receiverId,
            status: "ringing",
            isVideo: isVideoCall,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[startCall] CallDoc ${currentCallId} created.`);

        // Listen for remote answer
        currentCallListener = callDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (!data) {
                endCallUI("Caller: Document deleted by remote/system");
                return;
            }

            if (!pc.currentRemoteDescription && data.answer) {
                console.log("[startCall] Received Answer. Setting Remote SDP...");
                pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                    .catch(e => console.error("setRemoteDescription Error:", e));
            }
        });

        // Listen for candidates
        candidateListener = callDoc.collection('answerCandidates').onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    console.log("[startCall] Adding answer candidate...");
                    pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))
                        .catch(e => console.warn("addIceCandidate Error:", e));
                }
            });
        });

    } catch (err) {
        console.error("[startCall] FAILED:", err);
        endCallUI(`StartCall Error: ${err.message}`);
    }
}

// 2. Listen for Incoming Calls
function listenForCalls(uid) {
    const activeUid = uid || (window.userData ? window.userData.uid : null);
    if (!activeUid) {
        console.warn("[listenForCalls] No UID found, listener aborted.");
        return;
    }

    if (incomingCallListener) incomingCallListener();

    console.log("[listenForCalls] Starting listener for UID:", activeUid);
    incomingCallListener = db.collection('calls')
        .where('receiverId', '==', activeUid)
        .where('status', '==', 'ringing')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const callData = change.doc.data();
                    currentCallId = change.doc.id;
                    otherParticipantId = callData.callerId;
                    isVideoCall = callData.isVideo || false;

                    console.log(`[IncomingCall]: From ${callData.callerName}. Video: ${isVideoCall}`);
                    if (ringtoneAudio) ringtoneAudio.play().catch(e => console.warn("Ringtone Fail:", e));

                    document.getElementById('incoming-caller-name').innerText = callData.callerName;
                    document.querySelector('.wa-call-status').innerText = isVideoCall ? "Incoming Video Call" : "Incoming Voice Call";
                    incomingCallModal.classList.remove('hidden');
                    window.amICaller = false;
                    document.getElementById('active-call-name').innerText = callData.callerName;
                }

                if (change.type === 'removed') {
                    if (!activeCallModal.classList.contains('hidden')) return;
                    console.log("[IncomingCall] Removed from collection.");
                    if (ringtoneAudio) { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; }
                    incomingCallModal.classList.add('hidden');
                    currentCallId = null;
                }
            });
        });
}

// 3. Answer Call (Receiver)
async function answerCall(callId) {
    if (!callId) return;
    clearCallListeners();

    incomingCallModal.classList.add('hidden');
    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Connecting...";

    if (ringtoneAudio) { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; }

    try {
        console.log(`[answerCall] Connecting to ${callId}...`);
        await setupLocalStream(isVideoCall);

        const callDoc = db.collection('calls').doc(callId);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                callDoc.collection('answerCandidates').add(event.candidate.toJSON());
            }
        };

        const callData = (await callDoc.get()).data();
        if (!callData) {
            endCallUI("AnswerCall: Document vanished");
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        await callDoc.update({
            answer: { sdp: answerDescription.sdp, type: answerDescription.type },
            status: "connected"
        });

        if (!callStartTime) callStartTime = Date.now();
        console.log("[answerCall] Connected.");

        // Listen for caller candidates
        candidateListener = callDoc.collection('offerCandidates').onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))
                        .catch(e => console.warn("Offer Candidate Fail:", e));
                }
            });
        });

        // Listen if document is deleted
        currentCallListener = callDoc.onSnapshot(snapshot => {
            if (!snapshot.exists) {
                endCallUI("Answer: Caller deleted document");
            }
        });

    } catch (err) {
        console.error("[answerCall] FAILED:", err);
        endCallUI(`AnswerCall Error: ${err.message}`);
    }
}

// 4. End Call
async function endCall() {
    console.log("[endCall] Manual hangup triggered.");
    if (currentCallId) {
        try {
            await db.collection('calls').doc(currentCallId).delete();
        } catch (e) { console.error("Delete doc fail:", e); }
    }

    let duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    if (otherParticipantId) {
        if (window.amICaller) {
            addCallLog(duration > 0 ? 'answered' : 'missed', otherParticipantId, duration, window.userData.uid, otherParticipantId);
        }
    }
    endCallUI("Manual Hangup");
}

function endCallUI(reason = "Normal") {
    console.log(`[endCallUI] DISCONNECT REASON: ${reason}`);

    clearCallListeners();

    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log(` Stopping Local Track: ${track.kind}`);
            track.stop();
        });
    }

    if (pc) {
        try { pc.close(); } catch (e) { }
    }

    // Full Reset
    pc = new RTCPeerConnection(servers);
    localStream = null;
    remoteStream = null;
    currentCallId = null;
    callStartTime = null;
    otherParticipantId = null;
    window.amICaller = null;
    isVideoCall = false;

    // Reset UI State
    isMuted = false;
    isCameraOn = true;
    if (muteBtn) { muteBtn.classList.remove('active'); muteBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }
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

// Global Handlers
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
    } catch (e) { console.error("CallLog Fail:", e); }
}
