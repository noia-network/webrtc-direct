import { WebRTCDirect } from "./index";

const CONTROL_PORT = 12345;
const DATA_PORT = 12346;

it("listens and closes", done => {
    const listeningFn = jest.fn();
    expect.assertions(4);

    const webRTCDirect = new WebRTCDirect(CONTROL_PORT, DATA_PORT);
    expect(webRTCDirect.server.listening).toBe(false);
    webRTCDirect.on("listening", () => {
        listeningFn();
        expect(webRTCDirect.server.listening).toBe(true);
        webRTCDirect.close();
    });
    webRTCDirect.on("closed", () => {
        expect(webRTCDirect.server.listening).toBe(false);
        expect(listeningFn).toHaveBeenCalledTimes(1);
        done();
    });
    webRTCDirect.listen();
});

it("listens and closes (promise)", async done => {
    try {
        const webRTCDirect = new WebRTCDirect(CONTROL_PORT, DATA_PORT);
        expect(webRTCDirect.server.listening).toBe(false);
        await webRTCDirect.listen();
        expect(webRTCDirect.server.listening).toBe(true);
        await webRTCDirect.close();
        expect(webRTCDirect.server.listening).toBe(false);
        done();
    } catch (error) {
        done.fail(error);
    }
});

it("emits error if port is in use", done => {
    const webRTCDirect1Error1 = jest.fn();
    expect.assertions(1);

    const webRTCDirect1 = new WebRTCDirect(CONTROL_PORT, DATA_PORT);
    webRTCDirect1.on("error", () => {
        webRTCDirect1Error1();
    });
    webRTCDirect1.listen();

    const webRTCDirect2 = new WebRTCDirect(CONTROL_PORT, DATA_PORT);
    webRTCDirect2.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            Promise.all([webRTCDirect1.close(), webRTCDirect2.close()]).then(() => {
                expect(webRTCDirect1Error1).not.toBeCalled();
                done();
            });
        }
    });
    webRTCDirect2.listen();
});
