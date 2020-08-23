import { none, Option } from "@aicacia/core";
import { IJSONObject } from "@aicacia/json";
import { EventEmitter } from "events";

const NAMSPACE = "urn:x-cast:aicacia",
  STUN_URL = "stun:stun.l.google.com:19302",
  RECEIVER_APPLICATION_ID = "41A895CA";

export const events = new EventEmitter();

const PEER_CONNECTION: Option<RTCPeerConnection> = none();
const RTP_SENDERS: Map<any, RTCRtpSender> = new Map();

const onGCastApiAvailable = (available: boolean, reason: string) => {
  if (available) {
    initializeCastApi();
  } else {
    console.error(reason);
  }
};

window.__onGCastApiAvailable = onGCastApiAvailable as (
  available: boolean
) => void;

function getCurrentSession(): Option<cast.framework.CastSession> {
  return Option.from(
    cast.framework.CastContext.getInstance().getCurrentSession()
  );
}

let castApiInitialized = false;

export function initializeCastApi() {
  if (castApiInitialized) {
    return;
  } else {
    castApiInitialized = true;
  }
  const castContext = cast.framework.CastContext.getInstance();

  castContext.setOptions({
    receiverApplicationId: RECEIVER_APPLICATION_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });

  castContext.addEventListener(
    cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
    (sessionEvent) => {
      switch (sessionEvent.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED: {
          PEER_CONNECTION.replace(
            new RTCPeerConnection({
              iceServers: [
                {
                  urls: STUN_URL,
                },
              ],
            })
          ).ifSome((pc) => {
            pc.addEventListener("icecandidate", (event) => {
              if (event.candidate) {
                sendMessage({
                  type: "candidate",
                  candidate: event.candidate as any,
                }).ifSome((promise) =>
                  promise.catch(createOnError("icecandidate"))
                );
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
                    pc.setRemoteDescription(
                      new RTCSessionDescription(event.sdp)
                    )
                      .then(() => {
                        PEER_CONNECTION.ifSome((pc) => {
                          if (pc.remoteDescription?.type === "offer") {
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
                    pc.addIceCandidate(
                      new RTCIceCandidate(event.candidate)
                    ).catch(createOnError("addIceCandidate"));
                  });
                  break;
                case "resize":
                  events.emit("resize", event.width, event.height);
                  break;
              }
            });
          });

          events.emit("start");
          break;
        }
        case cast.framework.SessionState.SESSION_ENDED: {
          removeMediaStreamTracks();
          events.emit("end");
          break;
        }
      }
    }
  );
}

export function sendMediaStream(mediaStream: MediaStream) {
  PEER_CONNECTION.ifSome((pc) => {
    mediaStream.getAudioTracks().forEach((audioTrack) => {
      RTP_SENDERS.set(audioTrack, pc.addTrack(audioTrack, mediaStream));
    });
    mediaStream.getVideoTracks().forEach((videoTrack) => {
      RTP_SENDERS.set(videoTrack, pc.addTrack(videoTrack, mediaStream));
    });
  });
}

export function removeMediaStream(mediaStream: MediaStream) {
  mediaStream.getAudioTracks().forEach(removeMediaStreamTrack);
  mediaStream.getVideoTracks().forEach(removeMediaStreamTrack);
}

export function removeMediaStreamTrack(mediaStreamTrack: MediaStreamTrack) {
  PEER_CONNECTION.ifSome((pc) => {
    Option.from(RTP_SENDERS.get(mediaStreamTrack)).ifSome((sender) => {
      pc.removeTrack(sender);
      RTP_SENDERS.delete(mediaStreamTrack);
    });
  });
}

export function removeMediaStreamTracks() {
  PEER_CONNECTION.ifSome((pc) => {
    RTP_SENDERS.forEach((sender) => {
      pc.removeTrack(sender);
    });
  });
  RTP_SENDERS.clear();
}

function onLocalDescCreated(desc: RTCSessionDescriptionInit) {
  return PEER_CONNECTION.ifSome((pc) => {
    pc.setLocalDescription(desc).then(() => {
      sendMessage({
        type: "sdp",
        sdp: pc.localDescription as any,
      }).ifSome((promise) =>
        promise.catch(createOnError("setLocalDescription"))
      );
    });
  });
}

function sendMessage(message: IJSONObject) {
  return getCurrentSession().map((session) =>
    session.sendMessage(NAMSPACE, message)
  );
}

function createOnError(name: string) {
  return function onError(error: Error) {
    console.error(name, error);
  };
}
