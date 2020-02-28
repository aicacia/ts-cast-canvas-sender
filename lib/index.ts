import { none, Option } from "@aicacia/core";
import { EventEmitter } from "events";

const NAMSPACE = "urn:x-cast:aicacia",
  STUN_URL = "stun:stun.l.google.com:19302";

export const events = new EventEmitter();

const PEER_CONNECTION: Option<RTCPeerConnection> = none();
const RTP_SENDER: Option<RTCRtpSender> = none();

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

function initializeCastApi() {
  const castContext = cast.framework.CastContext.getInstance();

  castContext.setOptions({
    receiverApplicationId: "41A895CA",
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  });

  castContext.addEventListener(
    cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
    sessionEvent => {
      switch (sessionEvent.sessionState) {
        case cast.framework.SessionState.SESSION_STARTED: {
          PEER_CONNECTION.replace(
            new RTCPeerConnection({
              iceServers: [
                {
                  urls: STUN_URL
                }
              ]
            })
          ).ifSome(pc => {
            pc.addEventListener("icecandidate", event => {
              if (event.candidate) {
                getCurrentSession().ifSome(session => {
                  session
                    .sendMessage(NAMSPACE, {
                      type: "candidate",
                      candidate: event.candidate as any
                    })
                    .catch(createOnError("icecandidate"));
                });
              }
            });

            pc.addEventListener("negotiationneeded", () => {
              pc.createOffer()
                .then(onLocalDescCreated)
                .catch(createOnError("negotiationneeded"));
            });
          });

          getCurrentSession().ifSome(session => {
            session.addMessageListener(NAMSPACE, (namespace, json) => {
              const event = JSON.parse(json);

              switch (event.type) {
                case "sdp":
                  PEER_CONNECTION.ifSome(pc => {
                    pc.setRemoteDescription(
                      new RTCSessionDescription(event.sdp as any)
                    )
                      .then(() => {
                        PEER_CONNECTION.ifSome(pc => {
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
                  PEER_CONNECTION.ifSome(pc => {
                    pc.addIceCandidate(new RTCIceCandidate(event.candidate))
                      .then(() => {})
                      .catch(createOnError("addIceCandidate"));
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
          removeMediaStream();
          events.emit("end");
          break;
        }
      }
    }
  );
}

export function sendMediaStream(mediaStream: MediaStream) {
  removeMediaStream();
  PEER_CONNECTION.ifSome(pc => {
    RTP_SENDER.replace(
      pc.addTrack(mediaStream.getVideoTracks()[0], mediaStream)
    );
  });
}

export function removeMediaStream() {
  RTP_SENDER.take().ifSome(sender => {
    PEER_CONNECTION.ifSome(pc => {
      pc.removeTrack(sender);
    });
  });
}

function onLocalDescCreated(desc: RTCSessionDescriptionInit) {
  return PEER_CONNECTION.ifSome(pc => {
    pc.setLocalDescription(desc).then(() => {
      getCurrentSession().ifSome(session => {
        session
          .sendMessage(NAMSPACE, {
            type: "sdp",
            sdp: pc.localDescription
          })
          .catch(createOnError("setLocalDescription"));
      });
    });
  });
}

function createOnError(name: string) {
  return function onError(error: Error) {
    console.error(name, error);
  };
}
