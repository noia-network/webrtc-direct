import { ContentsClient } from "@noia-network/node-contents-client";
import { Channel } from "../src/channel";
import { WebRtcDirect } from "../src/index";
import { countChannels, filterIp, getConfig } from "./common";
import { logger } from "../src/logger";
import { Content } from "@noia-network/node-contents-client/dist/content";

const config = getConfig();
const contentsClient = new ContentsClient(null, config.STORAGE_DIR);
registerContentsClientListeners();
contentsClient.start();

const webRtcDirect = new WebRtcDirect(Number(config.CONTROL_PORT), Number(config.DATA_PORT), config.CONTROL_IP, config.DATA_IP);
webRtcDirect.on("connection", (channel: Channel) => {
    logger.info(`[${channel.id}] ip=${filterIp(channel)} connected, clients=${countChannels(webRtcDirect.channels)}`);
    // tslint:disable-next-line:no-any
    channel.on("data", (data: any) => {
        handleRequest(data, channel);
    });
    channel.on("error", (error: Error) => {
        logger.info(`${channel.id} error`, error);
    });
    channel.on("closed", () => {
        logger.info(`[${channel.id}] ip=${filterIp(channel)} closed, clients=${countChannels(webRtcDirect.channels)}`);
    });
});
webRtcDirect.listen();

function registerContentsClientListeners(): void {
    contentsClient.on("seeding", (infoHashes: string[]) => {
        logger.info("seeding", infoHashes);
    });
    contentsClient.on("downloaded", (chunkSize: number) => {
        logger.info("downloaded", chunkSize);
    });
    contentsClient.on("uploaded", (chunkSize: number) => {
        logger.info("uploaded", chunkSize);
    });
}

async function handleRequest(data: string, channel: Channel): Promise<void> {
    let params;
    try {
        params = JSON.parse(data);
    } catch (err) {
        console.error("expecting JSON");
        return;
    }

    const piece = params.piece;
    const offset = params.offset;
    const length = params.length;
    const infoHash = params.infoHash;

    // TODO: handle bad input.
    if (typeof piece === "undefined" || typeof offset === "undefined" || typeof infoHash === "undefined") {
        console.error(`bad request infoHash=${infoHash} index=${piece} offset=${offset} length=${length}`);
        return;
    } else {
        console.info(`request infoHash=${infoHash} index=${piece} offset=${offset} length=${length}`);
    }

    const content = contentsClient.get(infoHash) as Content;

    if (typeof content === "undefined") {
        console.error(`404 response infoHash=${infoHash}`);
        return;
    }

    const response = await content.getResponseBuffer(piece, offset, length);
    logger.info(`response infoHash=${infoHash} index=${piece} offset=${offset} length=${response.buffer.length}`);
    try {
        if (channel.dc == null) {
            logger.warn("invalid channel.dc");
            return;
        }
        channel.dc.send(response.buffer);
        content.emit("uploaded", response.buffer.length);
    } catch (e) {
        console.warn("Send content", e); // TODO: log property or just ignore.
    }
}
