const ContentsClient = require("@noia-network/node-contents-client"); // tslint:disable-line
import { Channel } from "../src/channel";
import { WebRTCDirect } from "../src/index";
import { config } from "./common";
import { logger } from "../src/logger";

if (!config) {
    throw new Error("config not found");
}

const contentsClient = new ContentsClient(null, config.STORAGE_DIR);
registerContentsClientListeners();
contentsClient.start();

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

function handleRequest(data: string, channel: Channel): void {
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

    if (typeof piece === "undefined" || typeof offset === "undefined" || typeof infoHash === "undefined") {
        console.error(`bad request infoHash=${infoHash} index=${piece} offset=${offset} length=${length}`);
        return;
    } else {
        console.info(`request infoHash=${infoHash} index=${piece} offset=${offset} length=${length}`);
    }

    const content = contentsClient.get(infoHash);

    if (typeof content === "undefined") {
        console.error(`404 response infoHash=${infoHash}`);
        return;
    }

    content.getResponseBuffer(piece, offset, length, (resBuff: any) => {
        logger.info(`response infoHash=${infoHash} index=${piece} offset=${offset} length=${resBuff.length}`);
        try {
            channel.dc.send(resBuff);
            content.emit("uploaded", resBuff.length);
        } catch (e) {
            console.warn("Send content", e); // TODO: log property or just ignore.
        }
    });
}
