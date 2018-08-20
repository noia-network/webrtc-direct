import * as Q from "q";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as http from "http";
import * as morgan from "morgan";
import * as wrtc from "wrtc";
import { RTCPeerConnectionState } from "wrtc";
import chalk from "chalk";
import { Channel } from "./channel";
import { EventEmitter } from "events";
import { UdpProxy } from "./udp-proxy";
import { cors } from "./cors";
import { logger } from "./logger";

const DO_MAPPING = true;
const DO_TIMEOUT = false;
const LOG_PREFIX: string = chalk.blue("WebRTC Direct:");

export enum Statuses {
    WaitingForAnswer,
    ChannelEstablished,
    Answered
}

export class WebRtcDirect extends EventEmitter {
    constructor(
        private readonly controlPort: number,
        private readonly dataPort: number,
        private readonly controlIp: string = "0.0.0.0",
        private readonly dataIp?: string
    ) {
        super();

        this.udpProxy = new UdpProxy(dataPort);
        this.controlPort = controlPort;
        this.dataPort = dataPort;

        if (logger.level === "verbose") {
            this.app.use(morgan("dev"));
        }
        this.app.use(bodyParser.json());
        this.app.use(cors("*"));
        this.app.post("/channels", this.postChannels.bind(this));
        this.app.post("/channels/:channelId/answer", this.postChannelAnswer.bind(this));
        this.app.post("/channels/:channelId/close", this.postChannelClose.bind(this));

        this.server.on("error", (err: NodeJS.ErrnoException) => {
            logger.error(`${LOG_PREFIX} HTTP error`);
            this.emit("error", err);
        });
        this.server.on("close", () => {
            logger.info(`${LOG_PREFIX} HTTP closed`);
        });

        this.udpProxy.on("error", (err: NodeJS.ErrnoException) => {
            logger.error(`${LOG_PREFIX} UDP error`);
            this.emit("error", err);
        });
    }

    private app: express.Express = express();
    private udpProxy: UdpProxy;
    public readonly channels: { [name: string]: Channel } = {};
    public readonly server: http.Server = http.createServer(this.app);

    public async listen(): Promise<void> {
        await this.udpProxy.listen();
        await this.listenInternal();
        this.emit("listening");
        logger.info(chalk.green(`${LOG_PREFIX} Listening for HTTP requests on port ${this.controlPort}`));
    }

    private async listenInternal(): Promise<void> {
        return new Promise<void>(resolve => {
            this.server.listen(this.controlPort, this.controlIp, () => {
                resolve();
            });
        });
    }

    public async close(): Promise<void> {
        await this.closeInternal();
        await this.udpProxy.close();
        this.emit("closed");
        logger.info(chalk.green(`${LOG_PREFIX} Closed listening for WebRTC requests on port ${this.controlPort}`));
    }

    private async closeInternal(): Promise<void> {
        return new Promise<void>(resolve => {
            if (this.server.listening) {
                this.server.close(() => {
                    resolve();
                });
            } else {
                if (this.udpProxy.listening) {
                    this.once("listening", () => {
                        this.server.close(() => {
                            resolve();
                        });
                    });
                } else {
                    resolve();
                }
            }
        });
    }

    private postChannels(req: express.Request, res: express.Response): void {
        const isUDP = (candidate: wrtc.IceCandidate): boolean => {
            if (typeof candidate.candidate !== "string") {
                throw new Error("invalid candidate");
            }

            return candidate.candidate.includes("udp");
        };

        const pc1 = new wrtc.RTCPeerConnection();

        pc1.onerror = (error: ErrorEvent) => {
            logger.error(`${LOG_PREFIX} ${chalk.red("error")}`, error);
        };
        pc1.onnegotationneeded = (event: Event) => {
            logger.verbose(`${LOG_PREFIX} ${chalk.yellow("negotation-needed")}`, event);
        };
        pc1.onicecandidateerror = (event: Event) => {
            logger.error(`${LOG_PREFIX} ${chalk.yellow("ice-candidate-error")}`, event);
        };
        pc1.onsignalingstatechange = (event: Event) => {
            logger.verbose(`${LOG_PREFIX} ${chalk.yellow("signaling-state")}: ${chalk.yellowBright(pc1.signalingState.toString())}`);
        };
        pc1.oniceconnectionstatechange = (event: Event) => {
            logger.verbose(
                `${LOG_PREFIX} ${chalk.yellow("ice-connection-state")}: ${chalk.yellowBright(pc1.iceConnectionState.toString())}`
            );
        };
        pc1.onicegatheringstatechange = (event: Event) => {
            logger.verbose(`${LOG_PREFIX} ${chalk.yellow("ice-gathering-state")}: ${chalk.yellowBright(pc1.iceGatheringState.toString())}`);
        };
        pc1.onconnectionstatechange = (event: Event) => {
            logger.verbose(`${LOG_PREFIX} ${chalk.yellow("connection-state")}: ${chalk.yellowBright(pc1.connectionState.toString())}`);
            if (pc1.connectionState === RTCPeerConnectionState.Failed) {
                for (const [, ch] of Object.entries(this.channels)) {
                    if (ch.pc === pc1) {
                        this.channelClose(ch);
                    }
                }
            }
        };

        const channel = new Channel(pc1);
        this.channels[channel.id] = channel;

        const iceCandidates: wrtc.IceCandidate[] = [];
        const iceCandidateDeferred = Q.defer();
        let localDescription: RTCSessionDescriptionInit;
        const localDescriptionDeferred = Q.defer();

        /**
         * Split candidate string, change candidate port to data port and concatenate back to candidate string.
         */
        function mapPorts(iceCandidate: wrtc.IceCandidate, dataPort: number, dataIp?: string): wrtc.IceCandidate {
            if (iceCandidate.candidate == null) {
                throw new Error("invalid iceCandidate");
            }

            const cs: string[] = iceCandidate.candidate.split(" ");
            channel.localAddress = `${cs[4]}:${cs[5]}`;
            if (dataIp != null) {
                cs[4] = dataIp;
            }
            cs[5] = dataPort.toString();
            iceCandidate.candidate = cs.join(" ");
            return iceCandidate;
        }

        pc1.onicecandidate = (candidate: wrtc.RTCPeerConnectionIceEvent) => {
            if (candidate.candidate == null) {
                iceCandidateDeferred.resolve();
            } else {
                const iceCandidate: wrtc.IceCandidate = {
                    sdpMLineIndex: candidate.candidate.sdpMLineIndex,
                    candidate: candidate.candidate.candidate
                };
                if (isUDP(iceCandidate)) {
                    logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright(`${channel.id} pc1.onicecandidate (before)`)}`, iceCandidate);
                    if (DO_MAPPING) {
                        mapPorts(iceCandidate, this.dataPort, this.dataIp);
                        logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright(`${channel.id} pc1.onicecandidate (after)`)}`, iceCandidate);
                    }
                    iceCandidates.push(iceCandidate);
                }
            }
        };

        const dc1 = (channel.dc = pc1.createDataChannel("default"));
        channel.dc.onopen = () => {
            logger.info(`${LOG_PREFIX} ${chalk.greenBright(`${channel.id} pc1: data channel open`)}`);
            this.emit("connection", channel);
            channel.status = Statuses.ChannelEstablished;
            dc1.onmessage = (event: MessageEvent) => {
                channel.emit("data", event.data);
            };
        };

        createOffer1();

        Promise.all([iceCandidateDeferred.promise, localDescriptionDeferred.promise]).then(() => {
            res.status(200).json({
                success: true,
                channel_id: channel.id,
                offer: localDescription,
                ice_candidates: iceCandidates
            });
        });

        function setRemoteDescription2(desc: RTCSessionDescriptionInit): void {
            setTimeout(() => {
                localDescription = desc;
                localDescriptionDeferred.resolve();
            }, DO_TIMEOUT ? 10000 : 0);
        }

        function setLocalDescription1(desc: RTCSessionDescriptionInit): void {
            logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright(`${channel.id} pc1: set local description:`)}`, desc.sdp);
            pc1.setLocalDescription(new wrtc.RTCSessionDescription(desc), setRemoteDescription2.bind(null, desc), handleError);
        }

        function createOffer1(): void {
            logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright(`${channel.id} pc1: create offer`)}`);
            pc1.createOffer(setLocalDescription1, handleError);
        }

        function handleError(error: ErrorEvent): void {
            res.status(500).json({
                success: false,
                error: error
            });
        }
    }

    private postChannelAnswer(req: express.Request, res: express.Response): void {
        const channel = this.channelCheck(req, res);
        if (channel == null) {
            res.status(404).json({
                success: false,
                reason: "channel does not exist"
            });
            return;
        }

        if (channel.status !== Statuses.WaitingForAnswer) {
            res.status(400).json({
                success: false,
                reason: "channel is not waiting for answer"
            });
        }

        function setRemoteDescription1(desc: RTCSessionDescriptionInit): void {
            if (channel == null) {
                throw new Error("channel null");
            }

            logger.verbose(`${LOG_PREFIX} ${chalk.magentaBright(`${channel.id} pc1: set remote description`)}`, desc.sdp);
            channel.pc.setRemoteDescription(
                new wrtc.RTCSessionDescription(desc),
                () => {
                    res.status(200).json({
                        success: true
                    });
                    if (channel == null) {
                        throw new Error("channel shouldn't be destroyed!");
                    }
                    logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright("channel.pc.localDescription.sdp")}`, channel.pc.localDescription.sdp);
                    logger.verbose(
                        `${LOG_PREFIX} ${chalk.magentaBright("channel.pc.remoteDescription.sdp")}`,
                        channel.pc.remoteDescription.sdp
                    );
                },
                handleError
            );
            channel.status = Statuses.Answered;
        }

        function handleError(error: ErrorEvent): void {
            res.status(500).json({
                success: false,
                error: error
            });
        }

        setRemoteDescription1(req.body.answer);
        this.addIceCandidates(req, channel, req.body.ice_candidates);
    }

    /**
     * Split candidate string, change candidate port to data port and concatenate back to candidate string.
     */
    private mapPortsFromBrowser(req: express.Request, channel: Channel, iceCandidate: wrtc.IceCandidate): wrtc.IceCandidate {
        if (iceCandidate.candidate == null) {
            throw new Error("invalid candidate");
        }

        const cs: string[] = iceCandidate.candidate.split(" ");
        channel.remoteAddress = `${req.headers["x-forwarded-for"] || req.connection.remoteAddress}:${cs[5]}`;
        cs[5] = this.dataPort.toString();
        iceCandidate.candidate = cs.join(" ");

        return iceCandidate;
    }

    private addIceCandidates(req: express.Request, channel: Channel, iceCandidates: wrtc.IceCandidate[]): void {
        if (channel == null) {
            throw new Error("channel null");
        }

        const channelId = channel.id;
        iceCandidates.forEach((iceCandidate: wrtc.IceCandidate) => {
            logger.verbose(`${LOG_PREFIX} ${chalk.cyanBright(`${channelId} pc1: adding ice candidate from browser`)}`, iceCandidate);
            if (channel == null) {
                throw new Error("channel null");
            }
            iceCandidate = this.mapPortsFromBrowser(req, channel, iceCandidate);
            if (channel.localAddress == null || channel.remoteAddress == null) {
                throw new Error("localAddress or remoteAddress is null");
            }
            this.udpProxy.setMap(channel.localAddress, channel.remoteAddress);
            channel.pc.addIceCandidate(new wrtc.RTCIceCandidate(iceCandidate));
        });
    }

    private channelCheck(req: express.Request, res: express.Response): undefined | Channel {
        const channelId = req.params.channelId;
        if (channelId in this.channels == null) {
            res.status(404).json({
                success: false,
                reason: "channel not found"
            });
            return undefined;
        }

        return this.channels[channelId];
    }

    private postChannelClose(req: express.Request, res: express.Response): void {
        const channel = this.channelCheck(req, res);
        if (channel == null) {
            res.status(404).json({
                success: false,
                reason: "channel does not exist or already closed"
            });
            return;
        }
        logger.info(`${LOG_PREFIX} ${chalk.greenBright(`${channel.id} pc1: closed`)}`);
        this.channelClose(channel);
        res.status(200).send({
            success: true
        });
    }

    /**
     * Close data channel and unset UDP ports mapping.
     */
    private channelClose(channel: Channel): void {
        if (channel.localAddress == null || channel.remoteAddress == null) {
            throw new Error("localAddress or remoteAddress cannot be invalid!");
        }

        channel.pc.close();
        this.udpProxy.unsetMap(channel.localAddress, channel.remoteAddress);
        delete this.channels[channel.id];
        channel.emit("closed");
    }
}
