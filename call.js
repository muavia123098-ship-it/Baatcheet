// call.js - WebRTC Voice & Video Calling Logic

// WebRTC Configuration
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
let currentCallListener = null;
let candidateListener = null;
let callStartTime = null;
let otherParticipantId = null;
let currentCallId = null;
let callName = "";
let isVideoCall = false;
let isCameraOn = true;
let isMuted = false;

// DOM Refs
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
const localAudio = document.getElementById('local-audio');
const remoteAudio = document.getElementById('remote-audio');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const ringtoneAudio = document.getElementById('ringtone-audio');
const outgoingRingtoneAudio = document.getElementById('outgoing-ringtone-audio');
const callStatus = document.getElementById('call-status');

// Helper Actions
function clearCallListeners() {
    console.log("[clearCallListeners] Cleaning Firestore observers...");
    if (currentCallListener) { currentCallListener(); currentCallListener = null; }
    if (candidateListener) { candidateListener(); candidateListener = null; }
}

async function setupLocalStream(withVideo = false) {
    try {
        console.log(`[setupLocalStream] Requesting ${withVideo ? 'Video+Audio' : 'Audio Only'}`);
        const constraints = {
            video: withVideo ? { facingMode: 'user' } : false,
            audio: { echoCancellation: true, noiseSuppression: true }
        };

        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("[setupLocalStream] Success. Stream ID:", localStream.id);

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

        pc.oniceconnectionstatechange = () => {
            console.log("[ICE State]:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') {
                callStatus.innerText = "Connected";
                callStatus.style.color = "#00a884";
                if (remoteAudio) remoteAudio.play().catch(e => { });
                if (outgoingRingtoneAudio) { outgoingRingtoneAudio.pause(); outgoingRingtoneAudio.currentTime = 0; }
            } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
                console.warn("[ICE State] Disconnected unexpectedly.");
                endCallUI("Connection Failed");
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

        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

    } catch (err) {
        console.error("[setupLocalStream] Error:", err);
        throw err;
    }
}

// 1. Create a Call (Caller)
async function startCall(receiverId, withVideo = false) {
    if (!receiverId) return;

    isVideoCall = withVideo;
    clearCallListeners();

    activeCallModal.classList.remove('hidden');
    callStatus.innerText = "Calling...";

    if (activeChatData) {
        const other = getOtherParticipant(activeChatData);
        if (other) callName = other.nickname || other.name || "Contact";
    }
    document.getElementById('active-call-name').innerText = callName;

    try {
        console.log(`[startCall] Checking receiver status: ${receiverId}`);
        // 1. Check Offline Status (Presence)
        const userDoc = await db.collection('users').doc(receiverId).get();
        const userData = userDoc.data();

        // Change: Allow 'away' status for background support
        if (!userData || userData.status === 'offline') {
            console.warn("[startCall] Target is offline.");
            callStatus.innerText = "User is currently offline";
            callStatus.style.color = "#ff3b30";
            setTimeout(() => endCallUI("Receiver Offline"), 3000);
            return;
        }

        console.log(`[startCall] Initiating to ${receiverId}...`);
        if (outgoingRingtoneAudio) outgoingRingtoneAudio.play().catch(e => console.warn("Outgoing ringtone fail:", e));

        // 2. Ringing Timeout (45 seconds)
        window.callRingingTimeout = setTimeout(() => {
            if (callStatus.innerText === "Calling..." || callStatus.innerText === "Ringing...") {
                console.warn("[startCall] Ringing timed out.");
                callStatus.innerText = "User is not responding";
                callStatus.style.color = "#ff3b30";
                setTimeout(() => endCall(), 3000);
            }
        }, 45000);

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

        await callDoc.set({
            offer: { sdp: offerDescription.sdp, type: offerDescription.type },
            callerId: (window.userData && window.userData.uid) || auth.currentUser.uid,
            callerName: (window.userData && window.userData.name) || "User",
            receiverId: receiverId,
            status: "ringing",
            isVideo: isVideoCall,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log("[startCall] CallDoc created:", currentCallId);

        // Listen for remote updates
        currentCallListener = callDoc.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (!snapshot.exists || (data && data.status === 'ended')) {
                endCallUI("Call ended by receiver");
                return;
            }

            if (!pc.currentRemoteDescription && data.answer) {
                console.log("[startCall] Received Answer.");
                // Stop timeout when answered
                if (window.callRingingTimeout) { clearTimeout(window.callRingingTimeout); window.callRingingTimeout = null; }
                if (outgoingRingtoneAudio) { outgoingRingtoneAudio.pause(); outgoingRingtoneAudio.currentTime = 0; }
                pc.setRemoteDescription(new RTCSessionDescription(data.answer))
                    .catch(e => console.error("setRemoteDescription Fail:", e));
            }
        }, (error) => {
            console.error("[startCall] Snapshot Error:", error);
            endCallUI(`Signaling Error: ${error.message}`);
        });

        // Listen for candidates
        candidateListener = callDoc.collection('answerCandidates').onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(e => { });
                }
            });
        }, (err) => console.warn("AnswerCandidates Error:", err));

    } catch (err) {
        console.error("[startCall] FAILED:", err);
        endCallUI(`StartCall Error: ${err.message}`);
    }
}

// 2. Listen for Incoming Calls
function listenForCalls(uid) {
    const activeUid = uid || (window.userData ? window.userData.uid : (auth.currentUser ? auth.currentUser.uid : null));
    if (!activeUid) return;

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

                    console.log(`[IncomingCall]: From ${callData.callerName}.`);
                    if (ringtoneAudio) ringtoneAudio.play().catch(e => { });

                    // Notify if tab is in background
                    if (typeof showCallNotification === 'function') {
                        showCallNotification(callData.callerName);
                    }

                    document.getElementById('incoming-caller-name').innerText = callData.callerName;
                    document.querySelector('.wa-call-status').innerText = isVideoCall ? "Incoming Video Call" : "Incoming Voice Call";
                    incomingCallModal.classList.remove('hidden');
                    window.amICaller = false;
                    document.getElementById('active-call-name').innerText = callData.callerName;
                }

                if (change.type === 'removed') {
                    console.log("[IncomingCall] Signal removed.");
                    if (ringtoneAudio) { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; }
                    incomingCallModal.classList.add('hidden');
                    if (activeCallModal.classList.contains('hidden')) {
                        currentCallId = null;
                    }
                }
            });
        }, (error) => console.error("[listenForCalls] Error:", error));
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
        console.log(`[answerCall] Joining ${callId}...`);
        await setupLocalStream(isVideoCall);

        const callDoc = db.collection('calls').doc(callId);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                callDoc.collection('answerCandidates').add(event.candidate.toJSON());
            }
        };

        const callData = (await callDoc.get()).data();
        if (!callData || callData.status === 'ended') {
            endCallUI("Call no longer available");
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

        // Monitor for end signal
        currentCallListener = callDoc.onSnapshot(snapshot => {
            const data = snapshot.data();
            if (!snapshot.exists || (data && data.status === 'ended')) {
                endCallUI("Call ended by caller");
            }
        }, (error) => {
            console.error("[answerCall] Snapshot error:", error);
            endCallUI("Signaling Error");
        });

        candidateListener = callDoc.collection('offerCandidates').onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(e => { });
                }
            });
        }, (err) => console.warn("OfferCandidates Error:", err));

    } catch (err) {
        console.error("[answerCall] FAILED:", err);
        endCallUI(`AnswerCall Error: ${err.message}`);
    }
}

// 4. End Call Logic
async function endCall() {
    console.log("[endCall] User hangup.");
    const idToKill = currentCallId;

    if (idToKill) {
        try {
            // Send explicit end status
            await db.collection('calls').doc(idToKill).update({ status: 'ended' }).catch(e => { });
            // Small delay for signal delivery, then delete
            setTimeout(async () => {
                await db.collection('calls').doc(idToKill).delete().catch(e => { });
            }, 2000);
        } catch (e) {
            await db.collection('calls').doc(idToKill).delete().catch(e => { });
        }
    }

    const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
    if (otherParticipantId && window.amICaller) {
        addCallLog(duration > 0 ? 'answered' : 'missed', otherParticipantId, duration);
    }

    endCallUI("Manual Hangup");
}

function endCallUI(reason = "Normal") {
    console.log(`[endCallUI] DISCONNECT REASON: ${reason}`);

    if (window.callRingingTimeout) { clearTimeout(window.callRingingTimeout); window.callRingingTimeout = null; }

    clearCallListeners();

    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.log(` Stopping: ${track.kind}`);
            track.stop();
        });
    }

    if (pc) {
        try { pc.close(); } catch (e) { }
    }

    // Reset PC properly
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
    if (muteBtn) { muteBtn.classList.remove('active'); muteBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }
    if (cameraBtn) { cameraBtn.classList.remove('active'); cameraBtn.style.display = 'none'; cameraBtn.innerHTML = '<i class="fas fa-video"></i>'; }

    if (videoContainer) videoContainer.style.display = 'none';
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    if (ringtoneAudio) { ringtoneAudio.pause(); ringtoneAudio.currentTime = 0; }
    if (outgoingRingtoneAudio) { outgoingRingtoneAudio.pause(); outgoingRingtoneAudio.currentTime = 0; }

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

async function addCallLog(type, otherUserId, duration = null) {
    if (!otherUserId) return;
    const myUid = (window.userData && window.userData.uid) || auth.currentUser.uid;
    const convId = [myUid, otherUserId].sort().join('_');
    try {
        await db.collection('conversations').doc(convId).collection('messages').add({
            text: isVideoCall ? 'Video Call' : 'Voice Call',
            senderId: myUid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'call',
            callStatus: type,
            callerId: myUid,
            receiverId: otherUserId,
            duration: duration,
            isVideo: isVideoCall,
            read: false, // Changed: Start as unread so auto-delete countdown starts after seen
            // expiryAt: Date.now() + (60 * 60 * 1000) // Removed: Countdown starts after seen
        });
    } catch (e) { console.error("CallLog Fail:", e); }
}
