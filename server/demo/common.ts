import * as dotenv from "dotenv";
import * as path from "path";
import { Channel } from "../src/channel";

export function getConfig(): { [name: string]: string } {
    const dotenvConfig = dotenv.config({ path: path.resolve(process.cwd(), ".env") });
    const config = dotenvConfig.parsed;
    if (dotenvConfig.error != null || config == null) {
        throw new Error("Could not read config file.");
    }
    return config;
}

export function filterIp(channel: Channel): string {
    if (channel.remoteAddress == null) {
        throw new Error("remoteAddress cannot be invalid.");
    }
    return channel.remoteAddress.split(":")[1];
}

export function countChannels(channels: { [name: string]: Channel }): number {
    return Object.keys(channels).length;
}
