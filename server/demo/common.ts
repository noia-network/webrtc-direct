import * as dotenv from "dotenv";
import * as path from "path";

export function getConfig(): { [name: string]: string } {
    const dotenvConfig = dotenv.config({ path: path.resolve(process.cwd(), ".env") });
    const config = dotenvConfig.parsed;
    if (dotenvConfig.error != null || config == null) {
        throw new Error("Could not read config file.");
    }
    return config;
}
