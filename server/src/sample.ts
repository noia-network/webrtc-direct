import { WebRTCDirect, Channel } from "./main"

const webRTCDirect = new WebRTCDirect()
webRTCDirect.on("data", (data: JSON, channel: Channel) => {
  console.log(`${channel.id} received data`, data)
  channel.dc.send(JSON.stringify(data))
})
webRTCDirect.on("error", (error: any, channel: Channel) => {
  console.log(`${channel.id} error`, error)
})
webRTCDirect.on("closed", (info: any, channelId: string) => {
  console.log(`${channelId} closed`, info)
})
webRTCDirect.listen()
