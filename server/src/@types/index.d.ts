declare module "wrtc" {
    export interface IceCandidate {
        sdpMLineIndex: any;
        candidate: any;
    }

    export interface Description {}

    export interface DataChannel {
        onmessage: (event: object) => void;
    }

    export class RTCSessionDescription {
        constructor(desc: Description);
    }

    export class RTCPeerConnection {
        signalingState: string;
        iceConnectionState: string;
        iceGatheringState: string;
        connectionState: string;

        onerror: (error: object) => void;
        onnegotationneeded: (error: object) => void;
        onicecandidateerror: (error: object) => void;
        onsignalingstatechange: (error: object) => void;
        oniceconnectionstatechange: (error: object) => void;
        onicegatheringstatechange: (error: object) => void;
        onconnectionstatechange: (error: object) => void;
        onicecandidate: (candidate: IceCandidate) => void;

        setLocalDescription: (rtcSD: RTCSessionDescription, setRemoteDescription: Function, handleError: Function) => void;
        createOffer: (setLocalDescription: Function, handleError: Function) => void;
        createDataChannel: (name: string) => DataChannel;
    }

    export class RTCIceCandidate {
        constructor(iceCandidate: IceCandidate);
    }
}
