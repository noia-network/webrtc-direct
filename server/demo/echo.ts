import { Channel } from "../src/channel";
import { WebRTCDirect } from "../src/index";
import { getConfig } from "./common";
import { logger } from "../src/logger";

const config = getConfig();
const webRTCDirect = new WebRTCDirect(Number(config.CONTROL_PORT), Number(config.DATA_PORT), config.IP);
webRTCDirect.on("connection", (channel: Channel) => {
    // tslint:disable-next-line:no-any
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
    if (channel.dc == null) {
        logger.warn("invalid channel.dc");
        return;
    }
    channel.dc.send(data);
}
