import * as dotenv from "dotenv";
import * as path from "path";

const dotenvConfig = dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const config = dotenvConfig.parsed;
if (dotenvConfig.error || !config) {
    throw new Error("could not read config file");
}

export { config };
