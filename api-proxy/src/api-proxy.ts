import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as morgan from "morgan";
import * as request from "request-promise-native";
import chalk from "chalk";
import { EventEmitter } from "events";
import { logger } from "./logger";

const LOG_PREFIX: string = chalk.blue("WebRTC Signaling Server:");

interface Options {
    ssl?: {
        key: string;
        cert: string;
        ca: string;
    };
}

export class ApiProxy extends EventEmitter {
    constructor(private readonly controlPort: number, private readonly controlIp: string = "0.0.0.0", private readonly opts: Options = {}) {
        super();

        this.controlPort = controlPort;

        this.app.use(cors());
        this.app.use(morgan("dev"));
        this.app.use(bodyParser.json());
        this.app.post("/channels", this.onPostRequest);
        this.app.post("/channels/:channelId/answer", this.onPostRequest);
        this.app.post("/channels/:channelId/close", this.onPostRequest);

        if (this.opts.ssl) {
            if (!fs.existsSync(this.opts.ssl.key)) {
                logger.warn(`no such file: ${this.opts.ssl.key}}`);
            }
            if (!fs.existsSync(this.opts.ssl.cert)) {
                logger.warn(`no such file: ${this.opts.ssl.cert}}`);
            }
            if (!fs.existsSync(this.opts.ssl.ca)) {
                logger.warn(`no such file: ${this.opts.ssl.ca}}`);
            }
        }

        this.server.on("error", (err: NodeJS.ErrnoException) => {
            logger.error(`${LOG_PREFIX} HTTP error`);
            this.emit("error", err);
        });
        this.server.on("close", () => {
            logger.info(`${LOG_PREFIX} HTTP closed`);
        });
    }

    private app: express.Express = express();
    public server: http.Server | https.Server =
        this.opts.ssl != null
            ? https.createServer({
                  key: fs.readFileSync(this.opts.ssl.key),
                  cert: fs.readFileSync(this.opts.ssl.cert),
                  ca: fs.readFileSync(this.opts.ssl.ca)
              })
            : http.createServer(this.app);

    private onPostRequest: express.RequestHandler = (req, res) => {
        if (req.headers["x-forwarded-host"] == null) {
            logger.error("Header X-Forwarded-Host is not present.");
            return;
        }
        const url = `${req.headers["x-forwarded-host"] + req.url}`;
        request
            .post({
                url: url,
                headers: {
                    "Content-Type": "application/json",
                    "X-Forwarded-For": `${req.headers["x-forwarded-for"] || req.connection.remoteAddress}`
                },
                body: req.body,
                json: true,
                resolveWithFullResponse: true
            })
            .then(response => {
                res.status(response.statusCode).json(response.body);
            })
            .catch(error => {
                logger.error(new Error(error.message));
            });
    };

    public async listen(): Promise<void> {
        return new Promise<void>(resolve => {
            this.server.listen(this.controlPort, this.controlIp, () => {
                logger.info(
                    chalk.green(
                        `${LOG_PREFIX} Listening ${this.server instanceof https.Server ? "HTTPS" : "HTTP"} on ${this.controlIp}:${
                            this.controlPort
                        }.`
                    )
                );
                resolve();
            });
        });
    }

    public async close(): Promise<void> {
        return new Promise<void>(resolve => {
            if (this.server.listening) {
                this.server.close(() => {
                    logger.info(chalk.green(`${LOG_PREFIX} Closed.`));
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}
