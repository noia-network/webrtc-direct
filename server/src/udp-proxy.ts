import chalk from "chalk";
import * as dgram from "dgram";
import { logger } from "./logger";

const SERVER_ADDRESS: string = "0.0.0.0";

export class UdpProxy {
    private server: dgram.Socket = dgram.createSocket("udp4");
    private portsMap: Map<string, string> = new Map<string, string>();
    constructor(serverPort: number) {
        this.server.on("error", err => {
            logger.info(`${chalk.blueBright("UDP proxy:")} server error:\n${err.stack}`);
            this.server.close();
        });
        this.server.on("message", (msg: Buffer, rinfo) => {
            const recPort = rinfo.port;
            const des = this.portsMap.get(`${rinfo.address}:${rinfo.port}`);
            if (!des) {
                return logger.info(`${chalk.bgRed("No mapping found")} for ${rinfo.address}:${rinfo.port}`);
            }
            const destIp = des.split(":")[0];
            const destPort = Number(des.split(":")[1]);
            logger.info(`${chalk.blueBright("UDP proxy:")} from ${rinfo.address}:${recPort} to ${destIp}:${destPort}`);
            this.server.send(msg, 0, msg.length, destPort, destIp);
        });
        this.server.on("listening", () => {
            const address: any = this.server.address();
            logger.info(`${chalk.blueBright("UDP proxy:")} server listening ${address.address}:${address.port}`);
        });
        this.server.bind(serverPort, SERVER_ADDRESS);
    }

    public setMap(addressA: string, addressB: string): void {
        logger.info(`${chalk.blueBright("UDP proxy:")} map ${addressA}<->${addressB}`);
        this.portsMap.set(addressA, addressB);
        this.portsMap.set(addressB, addressA);
    }
}
