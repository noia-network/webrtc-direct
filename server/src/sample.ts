import { WebRTCDirect } from "./main";
import Channel from "./channel";
import path from "path";
const ContentsClient = require("noia-node-contents-client");
const dotenv = require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
const config = dotenv.error ? {} : dotenv.parsed;

const contentsClient = new ContentsClient(null, config.STORAGE_DIR);
registerContentsClientListeners();
contentsClient.start();

const webRTCDirect = new WebRTCDirect(config.CONTROL_PORT, config.DATA_PORT, config.IP);
webRTCDirect.on("connection", (channel: Channel) => {
    channel.on("data", (data: any) => {
        handleRequest(data, channel);
    });
    channel.on("error", (error: Error) => {
        console.log(`${channel.id} error`, error);
    });
    channel.on("closed", () => {
        console.log(`${channel.id} closed`);
    });
});
webRTCDirect.listen();

function registerContentsClientListeners() {
    contentsClient.on("seeding", (infoHashes: string[]) => {
        console.log("seeding", infoHashes);
    });
    contentsClient.on("downloaded", (chunkSize: number) => {
        console.log("downloaded", chunkSize);
    });
    contentsClient.on("uploaded", (chunkSize: number) => {
        console.log("uploaded", chunkSize);
    });
}

function handleRequest(data: string, channel: Channel) {
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
        console.log(`response infoHash=${infoHash} index=${piece} offset=${offset} length=${resBuff.length}`);
        try {
            channel.dc.send(resBuff);
            content.emit("uploaded", resBuff.length);
        } catch (e) {
            console.warn("Send content", e); // TODO: log property or just ignore.
        }
    });
}
