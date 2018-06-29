import * as EventEmitter from "events";
import { Statuses } from "./index";

export class Channel extends EventEmitter {
    public id: string;
    public pc: any; // peer connection
    public status: Statuses;
    public dc: any; // data channel
    public localAddress?: string;
    public remoteAddress?: string;
    constructor(pc: any) {
        super();

        this.id = this.generateId();
        this.status = Statuses.WAITING_FOR_ANSWER;
        this.pc = pc;
    }

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
