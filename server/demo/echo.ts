import { Channel } from "../src/channel";
import { WebRtcDirect } from "../src/index";
import { countChannels, filterIp, getConfig } from "./common";
import { logger } from "../src/logger";

const config = getConfig();
const webRtcDirect = new WebRtcDirect(Number(config.CONTROL_PORT), Number(config.DATA_PORT), config.CONTROL_IP, config.DATA_IP);
webRtcDirect.on("connection", (channel: Channel) => {
    logger.info(`[${channel.id}] ip=${filterIp(channel)} connected, clients=${countChannels(webRtcDirect.channels)}`);
    // tslint:disable-next-line:no-any
    channel.on("data", (data: any) => {
        handleRequest(data, channel);
    });
    channel.on("error", error => {
        logger.info(`${channel.id} error`, error);
    });
    channel.on("closed", () => {
        logger.info(`[${channel.id}] ip=${filterIp(channel)} closed, clients=${countChannels(webRtcDirect.channels)}`);
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
