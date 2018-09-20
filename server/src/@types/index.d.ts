declare module "wrtc" {
    export const enum RTCSignalingState {
        Stable = "stable",
        HaveLocalOffer = "have-local-offer",
        HaveRemoteOffer = "have-remote-offer",
        HaveLocalPranswer = "have-local-pranswer",
        HaveRemotePranswer = "have-remote-pranswer",
        Closed = "closed"
    }

    export const enum RTCIceConnectionState {
        New = "new",
        Checking = "checking",
        Connected = "connected",
        Completed = "completed",
        Disconnected = "disconnected",
        Failed = "failed",
        Closed = "closed"
    }

    export const enum RTCIceGatheringState {
        New = "new",
        Hathering = "gathering",
        Complete = "complete"
    }

    export const enum RTCPeerConnectionState {
        "New" = "new",
        "Connecting" = "connecting",
        "Connected" = "connected",
        "Disconnected" = "disconnected",
        "Failed" = "failed",
        "Closed" = "closed"
    }

    export interface RTCPeerConnectionIceEvent extends Event {
        readonly candidate: IceCandidate;
    }

    export interface IceCandidate {
        sdpMLineIndex: number | null;
        candidate: string | null;
    }

    export interface Description {}

    export interface DataChannel extends EventTarget {
        onmessage: (event: MessageEvent) => void;
        onopen: (event: Event) => void;
        send: (data: any) => void;
    }

    export class RTCSessionDescription {
        constructor(desc: RTCSessionDescriptionInit);
    }

    interface handleErrorCallback {
        (error: ErrorEvent): void;
    }

    interface setLocalDescriptionFn {
        (rtcSD: RTCSessionDescriptionInit, successCallback: () => void, handleError: handleErrorCallback): void;
    }

    export class RTCPeerConnection extends EventTarget {
        signalingState: RTCSignalingState;
        iceConnectionState: RTCIceConnectionState;
        iceGatheringState: RTCIceGatheringState;
        connectionState: RTCPeerConnectionState;
        localDescription: RTCSessionDescriptionInit;
        remoteDescription: RTCSessionDescriptionInit;

        onerror: (event: ErrorEvent) => void;
        onnegotationneeded: (event: Event) => void;
        onicecandidateerror: (event: Event) => void;
        onsignalingstatechange: (event: Event) => void;
        oniceconnectionstatechange: (event: Event) => void;
        onicegatheringstatechange: (event: Event) => void;
        onconnectionstatechange: (event: Event) => void;
        onicecandidate: (candidate: RTCPeerConnectionIceEvent) => void;

        addIceCandidate: (candidate: RTCIceCandidate) => void;
        setRemoteDescription: (rtcSD: RTCSessionDescription, successCallback: () => void, handleError: handleErrorCallback) => void;
        setLocalDescription: (rtcSD: RTCSessionDescription, successCallback: () => void, handleError: handleErrorCallback) => void;
        createOffer: (setLocalDescription: setLocalDescriptionFn, handleError: handleErrorCallback) => void;
        createDataChannel: (name: string) => DataChannel;
        close: () => void;
    }

    export class RTCIceCandidate {
        constructor(iceCandidate: IceCandidate);
    }
}
