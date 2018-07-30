import { WebRtcDirect } from "./index";

const CONTROL_PORT = 12345;
const DATA_PORT = 12346;

it("listens and closes", done => {
    const listeningFn = jest.fn();
    expect.assertions(4);

    const webRtcDirect = new WebRtcDirect(CONTROL_PORT, DATA_PORT);
    expect(webRtcDirect.server.listening).toBe(false);
    webRtcDirect.on("listening", () => {
        listeningFn();
        expect(webRtcDirect.server.listening).toBe(true);
        webRtcDirect.close();
    });
    webRtcDirect.on("closed", () => {
        expect(webRtcDirect.server.listening).toBe(false);
        expect(listeningFn).toHaveBeenCalledTimes(1);
        done();
    });
    webRtcDirect.listen();
});

it("listens and closes (promise)", async done => {
    try {
        const webRtcDirect = new WebRtcDirect(CONTROL_PORT, DATA_PORT);
        expect(webRtcDirect.server.listening).toBe(false);
        await webRtcDirect.listen();
        expect(webRtcDirect.server.listening).toBe(true);
        await webRtcDirect.close();
        expect(webRtcDirect.server.listening).toBe(false);
        done();
    } catch (error) {
        done.fail(error);
    }
});

it("listens and closes 2 times (promise)", async done => {
    try {
        const webRtcDirect = new WebRtcDirect(CONTROL_PORT, DATA_PORT);
        expect(webRtcDirect.server.listening).toBe(false);
        await webRtcDirect.listen();
        expect(webRtcDirect.server.listening).toBe(true);
        await webRtcDirect.close();
        expect(webRtcDirect.server.listening).toBe(false);
        await webRtcDirect.listen();
        expect(webRtcDirect.server.listening).toBe(true);
        await webRtcDirect.close();
        done();
    } catch (error) {
        done.fail(error);
    }
});

it("emits error if port is in use", done => {
    const webRtcDirect1Error1 = jest.fn();
    expect.assertions(1);

    const webRtcDirect1 = new WebRtcDirect(CONTROL_PORT, DATA_PORT);
    webRtcDirect1.on("error", () => {
        webRtcDirect1Error1();
    });
    webRtcDirect1.listen();

    const webRtcDirect2 = new WebRtcDirect(CONTROL_PORT, DATA_PORT);
    webRtcDirect2.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            Promise.all([webRtcDirect1.close(), webRtcDirect2.close()]).then(() => {
                expect(webRtcDirect1Error1).not.toBeCalled();
                done();
            });
        }
    });
    webRtcDirect2.listen();
});
