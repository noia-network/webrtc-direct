import Channel from "./channel";
import EventEmitter from "events";
import Q from "q";
import UdpProxy from "./udp-proxy";
import chalk from "chalk";
import cors from "./cors";
import express from "express";
import http from "http";
import morgan from "morgan";
const bodyParser = require("body-parser");
const wrtc = require("wrtc");

const CONTROL_PORT = 60123;
const DO_MAPPING = true;
const DO_TIMEOUT = false;

export enum Statuses {
    WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER",
    CHANNEL_ESTABLISHED = "CHANNEL_ESTABLISHED",
    ANSWERED = "ANSWERED"
}

export interface IceCandidate {
    sdpMLineIndex: any;
    candidate: any;
}

export class WebRTCDirect extends EventEmitter {
    private app = express();
    private channels: { [name: string]: Channel } = {};
    private server: http.Server = http.createServer(this.app);
    private controlIp?: string;
    private controlPort: number;
    private udpProxy: UdpProxy;

    constructor(controlPort: number, dataPort: number, controlIp?: string) {
        super();

        this.udpProxy = new UdpProxy(dataPort);
        this.controlPort = controlPort;
        this.controlIp = controlIp || "0.0.0.0";

        this.app.use(morgan("dev"));
        this.app.use(bodyParser.json());
        this.app.use(cors("*"));
        this.app.post("/channels", this.postChannels.bind(this));
        this.app.post("/channels/:channelId/answer", this.postChannelAnswer.bind(this));
        this.app.post("/channels/:channelId/close", this.postChannelClose.bind(this));
    }

    public listen() {
        this.server.listen(this.controlPort, this.controlIp, () => {
            console.log(chalk.bgGreen(`Listening for HTTP requests on port ${this.controlPort}`));
        });
    }

    private postChannels(req: express.Request, res: express.Response) {
        const isUDP = (candidate: any): boolean => {
            return candidate.includes("udp");
        };

        const pc1 = new wrtc.RTCPeerConnection();

        pc1.onerror = (error: any) => {
            console.log(chalk.bgRed("error"), error);
        };
        pc1.onnegotationneeded = (event: any) => {
            console.log(chalk.bgYellow(`negotation-needed`), event);
        };
        pc1.onicecandidateerror = (event: any) => {
            console.log(chalk.bgYellow(`ice-candidate-error`), event);
        };
        pc1.onsignalingstatechange = (event: any) => {
            console.log(chalk.bgYellow(`signaling-state`), chalk.yellowBright(pc1.signalingState));
        };
        pc1.oniceconnectionstatechange = (event: any) => {
            console.log(chalk.bgYellow(`ice-connection-state`), chalk.yellowBright(pc1.iceConnectionState));
        };
        pc1.onicegatheringstatechange = (event: any) => {
            console.log(chalk.bgYellow(`ice-gathering-state`), chalk.yellowBright(pc1.iceGatheringState));
        };
        pc1.onconnectionstatechange = (event: any) => {
            console.log(chalk.bgYellow(`connection-state`), chalk.yellowBright(pc1.connectionState));
        };

        const channel = new Channel(pc1);
        this.channels[channel.id] = channel;

        const iceCandidates: IceCandidate[] = [];
        const iceCandidateDeferred = Q.defer();
        let localDescription: any;
        const localDescriptionDeferred = Q.defer();

        function mapPorts(iceCandidate: IceCandidate): IceCandidate {
            const cs = iceCandidate.candidate.split(" ");
            console.log(chalk.yellowBright(`Candidate mapping: ${cs[5]}->${CONTROL_PORT}`));
            channel.localAddress = `${cs[4]}:${cs[5]}`;
            cs[5] = CONTROL_PORT;
            iceCandidate.candidate = cs.join(" ");
            return iceCandidate;
        }

        pc1.onicecandidate = (candidate: any) => {
            if (!candidate.candidate) {
                iceCandidateDeferred.resolve();
            } else {
                const iceCandidate: IceCandidate = {
                    sdpMLineIndex: candidate.candidate.sdpMLineIndex,
                    candidate: candidate.candidate.candidate
                };
                if (isUDP(candidate.candidate.candidate)) {
                    console.log(chalk.cyanBright(`${channel.id} pc1.onicecandidate (before)`), JSON.stringify(iceCandidate, null, 2));
                    if (DO_MAPPING) mapPorts(iceCandidate);
                    if (DO_MAPPING)
                        console.log(chalk.cyanBright(`${channel.id} pc1.onicecandidate (after)`), JSON.stringify(iceCandidate, null, 2));
                    iceCandidates.push(iceCandidate);
                }
            }
        };

        const dc1 = (channel.dc = pc1.createDataChannel("default"));
        channel.dc.onopen = () => {
            console.log(chalk.greenBright(`${channel.id} pc1: data channel open`));
            this.emit("connection", channel);
            channel.status = Statuses.CHANNEL_ESTABLISHED;
            dc1.onmessage = (event: any) => {
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

        function setRemoteDescription2(desc: any) {
            setTimeout(() => {
                localDescription = desc;
                localDescriptionDeferred.resolve();
            }, DO_TIMEOUT ? 10000 : 0);
        }

        function setLocalDescription1(desc: any) {
            console.log(chalk.cyanBright(`${channel.id} pc1: set local description:`), desc.sdp);
            pc1.setLocalDescription(new wrtc.RTCSessionDescription(desc), setRemoteDescription2.bind(null, desc), handleError);
        }

        function createOffer1() {
            console.log(chalk.cyanBright(`${channel.id} pc1: create offer`));
            pc1.createOffer(setLocalDescription1, handleError);
        }

        function handleError(error: any) {
            res.status(500).json({
                success: false,
                error: error
            });
        }
    }

    private postChannelAnswer(req: express.Request, res: express.Response) {
        let channel = this.channelCheck(req, res);
        if (!channel) return;

        if (channel.status !== Statuses.WAITING_FOR_ANSWER) {
            res.status(400).json({
                success: false,
                reason: "channel is not waiting for answer"
            });
        }

        function setRemoteDescription1(desc: any) {
            if (!channel) {
                throw new Error("channel null");
            }
            console.log(chalk.magentaBright(`${channel.id} pc1: set remote description`), desc.sdp);
            channel.pc.setRemoteDescription(
                new wrtc.RTCSessionDescription(desc),
                () => {
                    res.status(200).json({
                        success: true
                    });
                    if (!channel) {
                        throw new Error("channel shouldn't be destroyed!");
                    }
                    console.log(chalk.cyanBright("channel.pc.localDescription.sdp"), channel.pc.localDescription.sdp);
                    console.log(chalk.magentaBright("channel.pc.remoteDescription.sdp"), channel.pc.remoteDescription.sdp);
                },
                handleError
            );
            channel.status = Statuses.ANSWERED;
        }

        function handleError(error: any) {
            res.status(500).json({
                success: false,
                error: error
            });
        }

        setRemoteDescription1(req.body.answer);
        this.addIceCandidates(req, channel, req.body.ice_candidates);
    }

    private mapPortsFromBrowser(req: express.Request, channel: Channel, iceCandidate: IceCandidate): IceCandidate {
        const cs = iceCandidate.candidate.split(" ");
        console.log(chalk.yellowBright(`Candidate mapping: ${cs[5]}->${CONTROL_PORT}`));
        channel.remoteAddress = `${req.headers["x-forwarded-for"] || req.connection.remoteAddress}:${cs[5]}`;
        cs[5] = CONTROL_PORT;
        iceCandidate.candidate = cs.join(" ");
        return iceCandidate;
    }

    private addIceCandidates(req: express.Request, channel: Channel, iceCandidates: IceCandidate[]) {
        if (!channel) {
            throw new Error("channel null");
        }
        const channelId = channel.id;
        iceCandidates.forEach((iceCandidate: IceCandidate) => {
            console.log(chalk.cyanBright(`${channelId} pc1: adding ice candidate from browser`), JSON.stringify(iceCandidate));
            if (!channel) {
                throw new Error("channel null");
            }
            iceCandidate = this.mapPortsFromBrowser(req, channel, iceCandidate);
            if (!channel.localAddress || !channel.remoteAddress) {
                throw new Error("localAddress or remoteAddress is null");
            }
            this.udpProxy.setMap(channel.localAddress, channel.remoteAddress);
            channel.pc.addIceCandidate(new wrtc.RTCIceCandidate(iceCandidate));
        });
    }

    private channelCheck(req: express.Request, res: express.Response) {
        const channelId = req.params.channelId;
        if (!(channelId in this.channels)) {
            res.status(404).json({
                success: false,
                reason: "channel not found"
            });
            return null;
        }
        return this.channels[channelId];
    }

    private postChannelClose(req: express.Request, res: express.Response) {
        const channel = this.channelCheck(req, res);
        if (!channel) return;
        console.log(chalk.redBright(`${channel.id} pc1: close`));
        channel.pc.close();
        channel.emit("closed");
        delete this.channels[channel.id];
        return res.status(200).send({
            success: true
        });
    }
}
