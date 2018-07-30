import { ApiProxy } from "../src/index";
import { getConfig } from "./common";

const config = getConfig();

const applyOptions = false;
const opts = applyOptions
    ? {
          ssl: {
              key: "/path/to/private.key",
              cert: "/path/to/cert.crt",
              ca: "/path/to/bundle.crt"
          }
      }
    : {};

const apiProxy = new ApiProxy(Number(config.CONTROL_PORT), config.IP, opts);
apiProxy.listen();
