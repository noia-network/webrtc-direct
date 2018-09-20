import * as EventEmitter from "events";
import * as wrtc from "wrtc";
import StrictEventEmitter from "strict-event-emitter-types";
import { Statuses } from "./webrtc-direct";

export interface ChannelEvents {
    closed: (this: Channel) => this;
    data: (this: Channel, data: string | Buffer | ArrayBuffer) => this;
    error: (this: Channel, error: Error) => this;
}

const ChannelEmitter: { new (): StrictEventEmitter<EventEmitter, ChannelEvents> } = EventEmitter;

export class Channel extends ChannelEmitter {
    constructor(pc: wrtc.RTCPeerConnection) {
        super();

        this.id = this.generateId();
        this.status = Statuses.WaitingForAnswer;
        this.pc = pc;
    }

    public id: string;
    public pc: wrtc.RTCPeerConnection;
    public status: Statuses;
    public dc: wrtc.DataChannel | undefined;
    public localAddress?: string;
    public remoteAddress?: string;

    private generateId(): string {
        const possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const ID_LENGTH: number = 24;
        let id: string = "";
        for (let i = 0; i < ID_LENGTH; i++) {
            id += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return id;
    }
}
