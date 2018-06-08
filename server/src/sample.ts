import { WebRTCDirect, Channel } from "./main"

const webRTCDirect = new WebRTCDirect()
webRTCDirect.on("data", (data: JSON, channel: Channel) => {
  console.log(`${channel.id} received data`, data)
  channel.dc.send(JSON.stringify(data))
})
webRTCDirect.on("error", (error: Error, channel: Channel) => {
  console.log(`${channel.id} error`, error)
})
webRTCDirect.on("closed", (channelId: string) => {
  console.log(`${channelId} closed`)
})
webRTCDirect.listen()
