// TODO: Remove this after resolving logging convention issue.
class Debugger {
    constructor(protected readonly console: Console, protected readonly showMessages: boolean, protected readonly prefix: string) {}

    public info(...message: any[]): void {
        if (this.showMessages) {
            this.console.info(this.prefix, message);
        }
    }
}

const showDebug: boolean = false;
export const debug = new Debugger(console, showDebug, "[webrtc-direct]");
