// TODO: Remove this after resolving logging convention issue.
class Debugger {
    constructor(protected readonly console: Console, protected readonly showMessages: boolean, protected readonly prefix: string) {}

    /* tslint:disable-next-line:no-any */
    public info(...message: any[]): void {
        if (this.showMessages) {
            this.console.info(this.prefix, ...message);
        }
    }

    /* tslint:disable-next-line:no-any */
    public warn(...message: any[]): void {
        this.console.warn(this.prefix, ...message);
    }
}

const SHOW_DEBUG: boolean = false;
export const debug = new Debugger(console, SHOW_DEBUG, "[webrtc-direct]");
