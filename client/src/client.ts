import * as getBrowserRtc from "get-browser-rtc";
import StrictEventEmitter from "strict-event-emitter-types";
import fetch from "node-fetch";
import { EventEmitter } from "events";
import { Mutex, MutexInterface } from "async-mutex";
import { debug } from "./debug";

interface Options {
    proxyAddress?: string;
    /* tslint:disable-next-line:no-any */
    wrtc?: any;
    /** If specified, then filter local candidate by IP. */
    candidateIp?: string;
}

export interface ClientEvents {
    closed: (this: Client) => this;
    connected: (this: Client) => this;
    data: (this: Client, data: string | Buffer | ArrayBuffer) => this;
    error: (this: Client, error: Error) => this;
}

const ClientEmitter: { new (): StrictEventEmitter<EventEmitter, ClientEvents> } = EventEmitter;

export class Client extends ClientEmitter {
    constructor(private readonly address: string, private readonly opts: Options = {}) {
        super();

        this.wrtc = opts.wrtc && typeof opts.wrtc === "object" ? opts.wrtc : getBrowserRtc();

        if (!this.wrtc) {
            if (typeof window === "undefined") {
                const error = new Error("No WebRTC support: Specify `opts.wrtc` option in this environment");
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    throw error;
                }
            } else {
                const error = new Error("No WebRTC support: Not a supported browser");
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    throw error;
                }
            }
        }

        this.iceCandidates = [];
        this.candidateIp = opts.candidateIp;
    }

    private channelData: ChannelData | undefined;
    private dc: RTCDataChannel | undefined;
    private iceCandidateMutex: MutexInterface = new Mutex();
    private iceCandidateMutexRelease: MutexInterface.Releaser | undefined;
    private iceCandidates: RTCIceCandidate[];
    private pc: RTCPeerConnection | undefined;
    /* tslint:disable-next-line:no-any */
    private wrtc: any;
    /** If specified, then filter local candidate by IP. */
    private candidateIp: string | undefined;

    public async connect(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.pc != null && this.pc.iceGatheringState !== "complete") {
                console.warn("ICE gathering state is not completed, skipping new connection request.");
                return;
            }

            this.iceCandidateMutexRelease = await this.iceCandidateMutex.acquire();

            const checkPassCandidate = (rtcIceCandidate: RTCIceCandidate): boolean => {
                if (rtcIceCandidate.candidate == null) {
                    return false;
                }
                if (!rtcIceCandidate.candidate.toUpperCase().includes("UDP")) {
                    return false;
                }
                if (this.candidateIp != null && !rtcIceCandidate.candidate.toUpperCase().includes(this.candidateIp)) {
                    return false;
                }
                return true;
            };

            this.pc = new this.wrtc.RTCPeerConnection({});

            if (this.pc == null) {
                throw new Error("pc is invalid");
            }

            this.pc.onnegotiationneeded = (event: Event) => {
                debug.info("negotation-needed", event);
            };
            this.pc.onicecandidateerror = (event: Event) => {
                debug.info("ice-candidate", event);
            };
            this.pc.onsignalingstatechange = event => {
                if (this.pc == null) {
                    return;
                }
                debug.info("signaling-state", this.pc.signalingState);
            };
            this.pc.oniceconnectionstatechange = event => {
                if (this.pc == null) {
                    return;
                }
                debug.info("ice-connection-state", this.pc.iceConnectionState);
            };
            this.pc.onicegatheringstatechange = event => {
                if (this.pc == null) {
                    return;
                }
                debug.info("ice-gathering-state", this.pc.iceGatheringState);
            };
            this.pc.onconnectionstatechange = event => {
                if (this.pc == null) {
                    return;
                }
                debug.info("connection-state", this.pc.connectionState);
                if (this.pc.connectionState === "failed") {
                    const err = new Error("pc.connectionState = failed");
                    if (this.listeners("connected").length > 0) {
                        this.emit("error", err);
                    } else {
                        reject(err);
                    }
                }
            };

            this.pc.onicecandidate = (candidate: RTCPeerConnectionIceEvent): void => {
                if (candidate.candidate == null) {
                    if (this.iceCandidateMutexRelease == null) {
                        throw new Error("Invalid iceCandidateMutexPromise.");
                    }
                    this.iceCandidateMutexRelease();
                } else {
                    const iceCandidate: RTCIceCandidate = candidate.candidate;
                    if (checkPassCandidate(iceCandidate)) {
                        if (this.channelData == null) {
                            throw new Error("invalid channelData");
                        }
                        debug.info(`${this.channelData.channelId} pc2.onicecandidate (before)`, JSON.stringify(iceCandidate));
                        this.iceCandidates.push(iceCandidate);
                    }
                }
            };

            this.pc.ondatachannel = event => {
                this.dc = event.channel;
                this.dc.binaryType = "arraybuffer";
                this.dc.onopen = () => {
                    debug.info("pc2: data channel open");
                    if (this.dc == null) {
                        throw new Error("invalid dataChannel");
                    }
                    this.dc.onmessage = (e: MessageEvent) => {
                        this.emit("data", e.data);
                    };
                    this.emit("connected");
                    resolve();
                };
            };

            try {
                const result = await fetch(`${this.getAddress()}/channels`, {
                    method: "POST",
                    headers: this.getHeaders()
                });
                const data: ChannelData = await result.json();
                debug.info("connect", data);
                this.channelData = data;
                this.setRemoteDescription2(data.offer as RTCSessionDescriptionInit);
                data.iceCandidates.forEach(iceCandidate => {
                    if (this.channelData == null) {
                        throw new Error("invalid channelData");
                    }
                    debug.info(`${this.channelData.channelId} adding remote ice candidates`, JSON.stringify(iceCandidate));
                    if (this.pc == null) {
                        throw new Error("invalid pc");
                    }
                    this.pc.addIceCandidate(new this.wrtc.RTCIceCandidate(iceCandidate as RTCIceCandidateInit));
                });
            } catch (error) {
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
            }
        });
    }

    public async send(msg: unknown): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.dc == null) {
                const error = new Error("dataChannel not available. Not connected?");
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
                return;
            }
            // @ts-ignore
            this.dc.send(msg);
            resolve();
        });
    }

    private handleError: RTCPeerConnectionErrorCallback = (error: DOMError): void => debug.info("error", error);

    public async stop(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.channelData == null) {
                const error = new Error("channelData is empty. Not connected?");
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
                return;
            }

            try {
                const result = await fetch(`${this.getAddress()}/channels/${this.channelData.channelId}/close`, {
                    method: "POST",
                    headers: this.getHeaders()
                });
                const resultJson = await result.json();

                if (this.channelData == null) {
                    throw new Error("invalid channelData");
                }
                debug.info(`${this.channelData.channelId} closed`, resultJson);
                this.emit("closed");
                resolve();
            } catch (error) {
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
            }
        });
    }

    /**
     *  If proxy address is set in options, use it.
     */
    private getAddress(): string {
        if (this.opts.proxyAddress != null) {
            return this.opts.proxyAddress;
        }

        return this.address;
    }

    /**
     * If proxy address is set in options, add additional headers.
     */
    private getHeaders(): { [name: string]: string } {
        const headers: { [name: string]: string } = {
            "Content-Type": "application/json"
        };
        if (this.opts.proxyAddress != null) {
            headers["X-Forwarded-Host"] = this.address;
        }
        return headers;
    }

    private async setRemoteDescription1(desc: RTCSessionDescription): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.channelData == null) {
                const error = new Error("invalid channelData");
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
                return;
            }
            debug.info(`${this.channelData.channelId} pc2: set remote description1 (send to node)`, desc.type, desc.sdp);
            try {
                if (this.iceCandidateMutex == null) {
                    throw new Error("invalid iceCandidateMutex");
                }
                this.iceCandidateMutex.runExclusive(async () => {
                    if (this.channelData == null) {
                        throw new Error("invalid channelData");
                    }
                    if (this.iceCandidates.length === 0) {
                        debug.warn("No local ICE candidates found");
                    }
                    const result = await fetch(`${this.getAddress()}/channels/${this.channelData.channelId}/answer`, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify({
                            answer: desc,
                            ice_candidates: this.iceCandidates
                        })
                    });
                    const resultJson = await result.json();
                    if (this.channelData == null) {
                        throw new Error("invalid channelData");
                    }
                    debug.info(`${this.channelData.channelId} setRemoteDescription1`, resultJson);
                    resolve();
                });
            } catch (error) {
                if (this.listeners("connected").length > 0) {
                    this.emit("error", error);
                } else {
                    reject(error);
                }
            }
        });
    }

    private setLocalDescription2(desc: RTCSessionDescriptionInit): void {
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channelId} pc2: set local description`, desc.type, desc.sdp);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
        // @ts-ignore
        this.pc.setLocalDescription(
            new this.wrtc.RTCSessionDescription(desc) as RTCSessionDescriptionInit,
            this.setRemoteDescription1.bind(this, desc),
            this.handleError.bind(this)
        );
    }

    private createAnswer2(): void {
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channelId} pc2: create answer`);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
        // @ts-ignore
        this.pc.createAnswer(this.setLocalDescription2.bind(this), this.handleError.bind(this));
    }

    private setRemoteDescription2(desc: RTCSessionDescriptionInit): void {
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channelId} pc2: set remote description`, desc.type, desc.sdp);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
        // @ts-ignore
        this.pc.setRemoteDescription(
            new this.wrtc.RTCSessionDescription(desc) as RTCSessionDescriptionInit,
            this.createAnswer2.bind(this),
            this.handleError.bind(this)
        );
    }
}
