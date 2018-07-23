import * as dgram from "dgram";
import chalk from "chalk";
import { AddressInfo } from "net";
import { EventEmitter } from "events";
import { logger } from "./logger";

const SERVER_ADDRESS: string = "0.0.0.0";

export class UdpProxy extends EventEmitter {
    constructor(public port: number) {
        super();
        this.server.on("error", (err: NodeJS.ErrnoException) => {
            logger.error(`${chalk.blueBright("UDP proxy:")} server error:\n${err.stack}`);
            this.emit("error", err);
            this.listening = false;
        });
        this.server.on("message", (msg: Buffer, rinfo) => {
            const recPort = rinfo.port;
            const des = this.portsMap.get(`${rinfo.address}:${rinfo.port}`);
            if (des == null) {
                return logger.info(`${chalk.bgRed("No mapping found")} for ${rinfo.address}:${rinfo.port}`);
            }
            const destIp = des.split(":")[0];
            const destPort = Number(des.split(":")[1]);
            logger.info(`${chalk.blueBright("UDP proxy:")} from ${rinfo.address}:${recPort} to ${destIp}:${destPort}`);
            this.server.send(msg, 0, msg.length, destPort, destIp);
        });
        this.server.on("listening", () => {
            const address: AddressInfo = this.server.address() as AddressInfo;
            logger.info(`${chalk.blueBright("UDP proxy:")} server listening ${address.address}:${address.port}`);
            this.listening = true;
        });
        this.server.on("close", () => {
            this.listening = false;
            this.emit("close");
        });
    }

    private portsMap: Map<string, string> = new Map<string, string>();
    private server: dgram.Socket = dgram.createSocket("udp4");
    public listening: boolean = false;

    public async listen(): Promise<void> {
        return new Promise<void>(resolve => {
            this.server.bind(this.port, SERVER_ADDRESS, () => {
                resolve();
            });
        });
    }

    /**
     * Close UDP proxy and clear ports mapping.
     */
    public async close(): Promise<void> {
        return new Promise<void>(resolve => {
            this.portsMap.clear();
            if (this.listening) {
                this.server.close(() => {
                    logger.info(`${chalk.blueBright("UDP proxy:")} closed.`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    public setMap(addressA: string, addressB: string): void {
        logger.info(`${chalk.blueBright("UDP proxy:")} map ${addressA}<->${addressB}`);
        this.portsMap.set(addressA, addressB);
        this.portsMap.set(addressB, addressA);
    }
}
