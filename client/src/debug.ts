import { Debugger } from "ts-debug";

const showDebug: boolean = false;
export const debug = new Debugger(console, showDebug, "[webrtc-direct] ");
