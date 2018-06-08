# webRTC Direct

NOIA webRTC direct implementation

# Quick Start

1. `cd server`
2. `npm install`
3. create `/server/.env` from `/server/.envexample` file.
4. `npm start`

Console should output
```
seeding [ 'd1e0c1717041cab86905a38bd8e7d2d4e5c939bb' ]
Listening for HTTP requests on port 3000
```
or similar.

5. serve `/client/index.html` via HTTP
6. press `connect`
7. enter request data in input near "Send" button, for example:
```json
{
  "infoHash": "d1e0c1717041cab86905a38bd8e7d2d4e5c939bb",
  "piece": 0,
  "offset": 0,
  "length": 0
}
```
8. press "Send"
9. inspect received `[object Blob]`