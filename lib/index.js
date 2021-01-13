"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMediaStreamTracks = exports.removeMediaStreamTrack = exports.removeMediaStream = exports.sendMediaStream = exports.initializeCastApi = exports.events = void 0;
const core_1 = require("@aicacia/core");
const events_1 = require("events");
const NAMSPACE = "urn:x-cast:aicacia", STUN_URL = "stun:stun.l.google.com:19302", RECEIVER_APPLICATION_ID = "41A895CA";
exports.events = new events_1.EventEmitter();
const PEER_CONNECTION = core_1.none();
const RTP_SENDERS = new Map();
const onGCastApiAvailable = (available, reason) => {
    if (available) {
        initializeCastApi();
    }
    else {
        console.error(reason);
    }
};
window.__onGCastApiAvailable = onGCastApiAvailable;
function getCurrentSession() {
    return core_1.Option.from(cast.framework.CastContext.getInstance().getCurrentSession());
}
let castApiInitialized = false;
function initializeCastApi() {
    if (castApiInitialized) {
        return;
    }
    else {
        castApiInitialized = true;
    }
    const castContext = cast.framework.CastContext.getInstance();
    castContext.setOptions({
        receiverApplicationId: RECEIVER_APPLICATION_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    castContext.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (sessionEvent) => {
        switch (sessionEvent.sessionState) {
            case cast.framework.SessionState.SESSION_STARTED: {
                PEER_CONNECTION.replace(new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: STUN_URL,
                        },
                    ],
                })).ifSome((pc) => {
                    pc.addEventListener("icecandidate", (event) => {
                        if (event.candidate) {
                            sendMessage({
                                type: "candidate",
                                candidate: event.candidate,
                            }).ifSome((promise) => promise.catch(createOnError("icecandidate")));
                        }
                    });
                    pc.addEventListener("negotiationneeded", () => {
                        pc.createOffer()
                            .then(onLocalDescCreated)
                            .catch(createOnError("negotiationneeded"));
                    });
                });
                getCurrentSession().ifSome((session) => {
                    session.addMessageListener(NAMSPACE, (namespace, json) => {
                        const event = JSON.parse(json);
                        switch (event.type) {
                            case "sdp":
                                PEER_CONNECTION.ifSome((pc) => {
                                    pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
                                        .then(() => {
                                        PEER_CONNECTION.ifSome((pc) => {
                                            var _a;
                                            if (((_a = pc.remoteDescription) === null || _a === void 0 ? void 0 : _a.type) === "offer") {
                                                pc.createAnswer()
                                                    .then(onLocalDescCreated)
                                                    .catch(createOnError("localDescCreated"));
                                            }
                                        });
                                    })
                                        .catch(createOnError("setRemoteDescription"));
                                });
                                break;
                            case "candidate":
                                PEER_CONNECTION.ifSome((pc) => {
                                    pc.addIceCandidate(new RTCIceCandidate(event.candidate)).catch(createOnError("addIceCandidate"));
                                });
                                break;
                            case "resize":
                                exports.events.emit("resize", event.width, event.height);
                                break;
                        }
                    });
                });
                exports.events.emit("start");
                break;
            }
            case cast.framework.SessionState.SESSION_ENDED: {
                removeMediaStreamTracks();
                exports.events.emit("end");
                break;
            }
        }
    });
}
exports.initializeCastApi = initializeCastApi;
function sendMediaStream(mediaStream) {
    PEER_CONNECTION.ifSome((pc) => {
        mediaStream.getAudioTracks().forEach((audioTrack) => {
            RTP_SENDERS.set(audioTrack, pc.addTrack(audioTrack, mediaStream));
        });
        mediaStream.getVideoTracks().forEach((videoTrack) => {
            RTP_SENDERS.set(videoTrack, pc.addTrack(videoTrack, mediaStream));
        });
    });
}
exports.sendMediaStream = sendMediaStream;
function removeMediaStream(mediaStream) {
    mediaStream.getAudioTracks().forEach(removeMediaStreamTrack);
    mediaStream.getVideoTracks().forEach(removeMediaStreamTrack);
}
exports.removeMediaStream = removeMediaStream;
function removeMediaStreamTrack(mediaStreamTrack) {
    PEER_CONNECTION.ifSome((pc) => {
        core_1.Option.from(RTP_SENDERS.get(mediaStreamTrack)).ifSome((sender) => {
            pc.removeTrack(sender);
            RTP_SENDERS.delete(mediaStreamTrack);
        });
    });
}
exports.removeMediaStreamTrack = removeMediaStreamTrack;
function removeMediaStreamTracks() {
    PEER_CONNECTION.ifSome((pc) => {
        RTP_SENDERS.forEach((sender) => {
            pc.removeTrack(sender);
        });
    });
    RTP_SENDERS.clear();
}
exports.removeMediaStreamTracks = removeMediaStreamTracks;
function onLocalDescCreated(desc) {
    return PEER_CONNECTION.ifSome((pc) => {
        pc.setLocalDescription(desc).then(() => {
            sendMessage({
                type: "sdp",
                sdp: pc.localDescription,
            }).ifSome((promise) => promise.catch(createOnError("setLocalDescription")));
        });
    });
}
function sendMessage(message) {
    return getCurrentSession().map((session) => session.sendMessage(NAMSPACE, message));
}
function createOnError(name) {
    return function onError(error) {
        console.error(name, error);
    };
}
