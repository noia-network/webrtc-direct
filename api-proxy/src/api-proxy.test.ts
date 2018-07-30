import { ApiProxy } from "./api-proxy";

const CONTROL_PORT = 12345;

it("listens and closes (promise)", async done => {
    try {
        const apiProxy = new ApiProxy(CONTROL_PORT);
        expect(apiProxy.server.listening).toBe(false);
        await apiProxy.listen();
        expect(apiProxy.server.listening).toBe(true);
        await apiProxy.close();
        expect(apiProxy.server.listening).toBe(false);
        done();
    } catch (error) {
        done.fail(error);
    }
});
