import * as getBrowserRtc from "get-browser-rtc";
import fetch from "node-fetch";
import { EventEmitter } from "events";
import { Mutex, MutexInterface } from "async-mutex";
import { debug } from "./debug";

interface Options {
    proxyAddress?: string;
    // TODO: fix any.
    wrtc?: any;
}

export class Client extends EventEmitter {
    constructor(private readonly address: string, private readonly opts: Options = {}) {
        super();

        this.wrtc = opts.wrtc && typeof opts.wrtc === "object" ? opts.wrtc : getBrowserRtc();

        if (!this.wrtc) {
            if (typeof window === "undefined") {
                this.emit("error", "No WebRTC support: Specify `opts.wrtc` option in this environment");
            } else {
                this.emit("error", "No WebRTC support: Not a supported browser");
            }
        }

        this.iceCandidates = [];
    }

    private channelData: ChannelData | undefined;
    private dc: RTCDataChannel | undefined;
    private iceCandidateMutex: MutexInterface = new Mutex();
    private iceCandidateMutexRelease: MutexInterface.Releaser | undefined;
    private iceCandidates: RTCIceCandidate[];
    private pc: RTCPeerConnection | undefined;
    // TODO: fix any.
    private wrtc: any;

    public async connect(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.pc != null && this.pc.iceGatheringState !== "complete") {
                console.warn("ICE gathering state is not completed, skipping new connection request.");
                return;
            }

            this.iceCandidateMutexRelease = await this.iceCandidateMutex.acquire();
            const isUDP = (candidate: RTCIceCandidate) => {
                if (candidate.candidate) {
                    return candidate.candidate.toUpperCase().includes("UDP");
                }
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
            };

            this.pc.onicecandidate = (candidate: RTCPeerConnectionIceEvent): void => {
                if (candidate.candidate == null) {
                    if (this.iceCandidateMutexRelease == null) {
                        throw new Error("invalid iceCandidateMutexPromise");
                    }
                    this.iceCandidateMutexRelease();
                } else {
                    const iceCandidate: RTCIceCandidate = candidate.candidate;
                    if (isUDP(iceCandidate)) {
                        if (this.channelData == null) {
                            throw new Error("invalid channelData");
                        }
                        debug.info(`${this.channelData.channel_id} pc2.onicecandidate (before)`, JSON.stringify(iceCandidate));
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
                data.ice_candidates.forEach(iceCandidate => {
                    if (this.channelData == null) {
                        throw new Error("invalid channelData");
                    }
                    debug.info(`${this.channelData.channel_id} adding remote ice candidates`, JSON.stringify(iceCandidate));
                    if (this.pc == null) {
                        throw new Error("invalid pc");
                    }
                    this.pc.addIceCandidate(new this.wrtc.RTCIceCandidate(iceCandidate as RTCIceCandidateInit));
                });
            } catch (error) {
                this.emit("error", error);
                reject(error);
            }
        });
    }

    public send(msg: any): void {
        if (this.dc == null) {
            this.emit("error", new Error("dataChannel not available. Not connected?"));
            return;
        }
        this.dc.send(msg);
    }

    private handleError: RTCPeerConnectionErrorCallback = (error: DOMError): void => debug.info("error", error);

    public async stop(): Promise<void> {
        if (this.channelData == null) {
            this.emit("error", new Error("channelData is empty. Not connected?"));
            return;
        }

        try {
            const result = await fetch(`${this.getAddress()}/channels/${this.channelData.channel_id}/close`, {
                method: "POST",
                headers: this.getHeaders()
            });
            const resultJson = await result.json();

            this.emit("closed");
            if (this.channelData == null) {
                throw new Error("invalid channelData");
            }

            debug.info(`${this.channelData.channel_id} closed`, resultJson);
        } catch (error) {
            this.emit("error", error);
        }
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
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channel_id} pc2: set remote description1 (send to node)`, desc.type, desc.sdp);
        try {
            if (this.iceCandidateMutex == null) {
                throw new Error("invalid iceCandidateMutex");
            }
            this.iceCandidateMutex.runExclusive(async () => {
                if (this.channelData == null) {
                    throw new Error("invalid channelData");
                }
                const result = await fetch(`${this.getAddress()}/channels/${this.channelData.channel_id}/answer`, {
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
                debug.info(`${this.channelData.channel_id} setRemoteDescription1`, resultJson);
            });
        } catch (error) {
            this.emit("error", error);
        }
    }

    private setLocalDescription2(desc: RTCSessionDescriptionInit): void {
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channel_id} pc2: set local description`, desc.type, desc.sdp);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
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
        debug.info(`${this.channelData.channel_id} pc2: create answer`);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
        this.pc.createAnswer(this.setLocalDescription2.bind(this), this.handleError.bind(this));
    }

    private setRemoteDescription2(desc: RTCSessionDescriptionInit): void {
        if (this.channelData == null) {
            throw new Error("invalid channelData");
        }
        debug.info(`${this.channelData.channel_id} pc2: set remote description`, desc.type, desc.sdp);
        if (this.pc == null) {
            throw new Error("invalid pc");
        }
        this.pc.setRemoteDescription(
            new this.wrtc.RTCSessionDescription(desc) as RTCSessionDescriptionInit,
            this.createAnswer2.bind(this),
            this.handleError.bind(this)
        );
    }
}
