import chalk from "chalk";
import dgram from "dgram";

const SERVER_ADDRESS: string = "0.0.0.0";

export = class UdpProxy {
    private server: dgram.Socket = dgram.createSocket("udp4");
    private portsMap = new Map<string, string>();
    constructor(serverPort: number) {
        this.server.on("error", err => {
            console.log(`${chalk.blueBright("UDP proxy:")} server error:\n${err.stack}`);
            this.server.close();
        });
        this.server.on("message", (msg: Buffer, rinfo) => {
            const recPort = rinfo.port;
            let des = this.portsMap.get(rinfo.address + ":" + rinfo.port);
            if (!des) {
                return console.log(chalk.bgRed("No mapping found"), rinfo.address + ":" + rinfo.port, this.portsMap.entries());
            }
            const destIp = des.split(":")[0];
            const destPort = Number(des.split(":")[1]);
            console.log(`${chalk.blueBright("UDP proxy:")} from ${rinfo.address}:${recPort} to ${destIp}:${destPort}`);
            this.server.send(msg, 0, msg.length, destPort, destIp);
        });
        this.server.on("listening", () => {
            const address: any = this.server.address();
            console.log(`${chalk.blueBright("UDP proxy:")} server listening ${address.address}:${address.port}`);
        });
        this.server.bind(serverPort, SERVER_ADDRESS);
    }

    public setMap(addressA: string, addressB: string) {
        console.log(`${chalk.blueBright("UDP proxy:")} map ${addressA}<->${addressB}`);
        this.portsMap.set(addressA, addressB);
        this.portsMap.set(addressB, addressA);
    }
};
