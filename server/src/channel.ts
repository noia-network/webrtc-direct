import * as EventEmitter from "events";
import * as wrtc from "wrtc";
import { Statuses } from "./index";

export class Channel extends EventEmitter {
    constructor(pc: wrtc.RTCPeerConnection) {
        super();

        this.id = this.generateId();
        this.status = Statuses.WAITING_FOR_ANSWER;
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
