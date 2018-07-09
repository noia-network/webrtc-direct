import { Channel } from "../src/channel";
import { WebRTCDirect } from "../src/index";
import { config } from "./common";
import { logger } from "../src/logger";

if (!config) {
    throw new Error("config not found");
}

const webRTCDirect = new WebRTCDirect(Number(config.CONTROL_PORT), Number(config.DATA_PORT), config.IP);
webRTCDirect.on("connection", (channel: Channel) => {
    channel.on("data", (data: any) => {
        handleRequest(data, channel);
    });
    channel.on("error", (error: Error) => {
        logger.info(`${channel.id} error`, error);
    });
    channel.on("closed", () => {
        logger.info(`${channel.id} closed`);
    });
});
webRTCDirect.listen();

function handleRequest(data: string, channel: Channel): void {
    channel.dc.send(data);
}
