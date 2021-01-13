import { EventEmitter } from "events";
export declare const events: EventEmitter;
export declare function initializeCastApi(): void;
export declare function sendMediaStream(mediaStream: MediaStream): void;
export declare function removeMediaStream(mediaStream: MediaStream): void;
export declare function removeMediaStreamTrack(mediaStreamTrack: MediaStreamTrack): void;
export declare function removeMediaStreamTracks(): void;
