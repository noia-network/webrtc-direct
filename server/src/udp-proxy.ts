import * as dgram from "dgram";
import chalk from "chalk";
import { AddressInfo } from "net";
import { EventEmitter } from "events";
import { logger } from "./logger";

const SERVER_ADDRESS: string = "0.0.0.0";
const LOG_PREFIX: string = chalk.blueBright("UDP proxy:");

export class UdpProxy extends EventEmitter {
    constructor(public port: number) {
        super();
    }

    private portsMap: Map<string, string> = new Map<string, string>();
    private server: dgram.Socket | undefined;
    public listening: boolean = false;

    /**
     * Creates socket, registers listeners and binds to socket.
     */
    public async listen(): Promise<void> {
        if (this.listening) {
            throw new Error("UDP proxy is already listening.");
        }

        return new Promise<void>(resolve => {
            try {
                this.server = dgram.createSocket("udp4");
                this.registerListeners();
                this.server.bind(this.port, SERVER_ADDRESS, () => {
                    resolve();
                });
            } catch (err) {
                console.error("error", err);
            }
        });
    }

    /**
     * Close UDP proxy, clear listeners and ports mapping.
     */
    public async close(): Promise<void> {
        if (this.listening === false) {
            logger.warn(`${LOG_PREFIX} UDP proxy socket is already closed.`);
            return;
        }

        return new Promise<void>(resolve => {
            this.portsMap.clear();
            if (this.server != null && this.listening === true) {
                this.server.removeAllListeners();
                this.server.close(() => {
                    logger.info(`${LOG_PREFIX} closed.`);
                    this.listening = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    public setMap(addressA: string, addressB: string): void {
        logger.verbose(`${LOG_PREFIX} set map ${addressA}<->${addressB}`);
        this.portsMap.set(addressA, addressB);
        this.portsMap.set(addressB, addressA);
    }

    public unsetMap(addressA: string, addressB: string): void {
        logger.verbose(`${LOG_PREFIX} unset map ${addressA}<->${addressB}`);
        this.portsMap.delete(addressA);
        this.portsMap.delete(addressB);
    }

    private registerListeners(): void {
        if (this.server == null) {
            throw new Error("Cannot add listeners on invalid server.");
        }

        this.server.on("error", (err: NodeJS.ErrnoException) => {
            logger.error(`${LOG_PREFIX} server error:\n${err.stack}`);
            this.emit("error", err);
            this.listening = false;
        });
        this.server.on("message", (msg: Buffer, rinfo) => {
            if (this.server == null) {
                logger.warn(`${LOG_PREFIX} Sending message failed, server is closed.`);
                return;
            }
            const recPort = rinfo.port;
            const des = this.portsMap.get(`${rinfo.address}:${rinfo.port}`);
            if (des == null) {
                return logger.verbose(`${LOG_PREFIX} ${chalk.red("No mapping found")} for ${rinfo.address}:${rinfo.port}`);
            }
            const destIp = des.split(":")[0];
            const destPort = Number(des.split(":")[1]);
            logger.verbose(`${LOG_PREFIX} from ${rinfo.address}:${recPort} to ${destIp}:${destPort}`);
            this.server.send(msg, 0, msg.length, destPort, destIp);
        });
        this.server.on("listening", () => {
            if (this.server == null) {
                logger.warn(`${LOG_PREFIX} Listening failed, server is closed.`);
                return;
            }
            const address: AddressInfo = this.server.address() as AddressInfo;
            logger.info(`${LOG_PREFIX} server listening ${address.address}:${address.port}`);
            this.listening = true;
        });
        this.server.on("close", () => {
            this.listening = false;
            this.emit("close");
        });
    }
}
