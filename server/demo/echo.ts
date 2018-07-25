import { Channel } from "../src/channel";
import { WebRtcDirect } from "../src/index";
import { getConfig } from "./common";
import { logger } from "../src/logger";

const config = getConfig();
const webRtcDirect = new WebRtcDirect(Number(config.CONTROL_PORT), Number(config.DATA_PORT), config.IP);
webRtcDirect.on("connection", (channel: Channel) => {
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
webRtcDirect.listen();

function handleRequest(data: string, channel: Channel): void {
    if (channel.dc == null) {
        logger.warn("invalid channel.dc");
        return;
    }
    channel.dc.send(data);
}
