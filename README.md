# WebRTC Direct

Use WebRTC RTCDataChannel in server/client programming pattern, removing the need for an extra signaling server.

Features

-   End-to-end encryption provided by RTCDataChannel.
-   Easy to use server/client programming interfaces for using WebRTC RTCDataChannel, encapsulating the details of how WebRTC peer connections function internally.
-   Data port multiplexing: all rtc data channel from different clients are multiplexed in one data port.

# Quick Demo

## Echo Server Setup

1.  `cd server`
2.  `npm install`
3.  create configuration `/server/.env` file from `/server/.envexample` file.
4.  `npm run build`
5.  `npm run demo-echo`

Console should output message (or similar):

```
info: UDP proxy: server listening 0.0.0.0:60123
info: Listening for HTTP requests on port 3000
```

## Echo Client

1.  cd `client`
2.  `npm install`
3.  `npm run build`
4.  copy `dist/webrtc-direct.min.js` into `client/demo` folder.
5.  serve `client/demo/echo.html` via HTTP
6.  open `demo.html` via HTTP protocol and press `connect`
7.  enter message in input near "Send" button.
8.  press "Send"
9.  inspect received `Echo: <your message>`

Note: `npm install` and `npm run build` to generate `dist` folder to use client as a library.
