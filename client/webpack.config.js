const path = require("path");

module.exports = (env, argv) => ({
    entry: {
        app: "./src/index.ts"
    },
    output: {
        filename: argv.mode === "production" ? "webrtc-direct.min.js" : "webrtc-direct.js",
        library: "WebRtcDirect",
        libraryTarget: "umd",
        path: path.resolve(__dirname, "dist"),
        umdNamedDefine: true
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    devtool: argv.mode === "production" ? false : "inline-source-map",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: "awesome-typescript-loader",
                    query: {
                        declaration: false
                    }
                },
                exclude: /node_modules/
            }
        ]
    }
});
