import * as winston from "winston";

const options: winston.LoggerOptions = {
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.colorize(), winston.format.simple(), winston.format.label({ label: "webrtc-direct" })),
    exitOnError: false,
    level: "info"
};

export const logger: winston.Logger = winston.createLogger(options);
