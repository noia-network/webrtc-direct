import { UdpProxy } from "./udp-proxy";

const DATA_PORT = 12346;

it("listens and closes (promise)", async done => {
    const udpProxy = new UdpProxy(DATA_PORT);
    try {
        await udpProxy.listen();
        await udpProxy.close();
        done();
    } catch (error) {
        done.fail(error);
    }
});

it("emits error if port is in use", done => {
    const udpProxyError1 = jest.fn();
    expect.assertions(1);

    const udpProxy1 = new UdpProxy(DATA_PORT);
    udpProxy1.on("error", () => {
        udpProxyError1();
    });
    udpProxy1.listen();

    const udpProxy2 = new UdpProxy(DATA_PORT);
    udpProxy2.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
            Promise.all([udpProxy1.close(), udpProxy2.close()]).then(() => {
                expect(udpProxyError1).not.toBeCalled();
                done();
            });
        }
    });
    udpProxy2.listen();
});
