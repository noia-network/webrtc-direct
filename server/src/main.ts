import EventEmitter from "events"
import Q from "q"
import express from "express"
import http from "http"
const wrtc = require("wrtc")

export enum Statuses {
  WAITING_FOR_ANSWER = "WAITING_FOR_ANSWER",
  CHANNEL_ESTABLISHED = "CHANNEL_ESTABLISHED",
  ANSWERED = "ANSWERED"
}

export interface Channel {
  id: string,
  pc: any,
  status: Statuses,
  dc: any
}

export interface IceCandidate {
  sdpMLineIndex: any,
  candidate: any
}

export class WebRTCDirect extends EventEmitter {
  public app = express()
  public channels: { [name: string]: Channel }
  public server: http.Server
  public port: number = 3000
  public ip: string
  constructor (ip: string) {
    super()
    this.server = http.createServer(this.app)
    this.channels = {}
    this.ip = ip || "0.0.0.0"

    this.app.use(require("body-parser").json())
    this.app.use(function(req: express.Request, res: express.Response, next: express.NextFunction) {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
      next()
    });
    this.app.post("/channels", this._postChannels.bind(this))
    this.app.post("/channels/:channelId/answer", this._postChannelAnswer.bind(this))
    this.app.post("/channels/:channelId/close", this._postChannelClose.bind(this))
  }

  listen () {
    this.server = this.app.listen(this.port, this.ip, () => {
      console.log(`Listening for HTTP requests on port ${this.port}`)
    })
  }

  generateId(): string {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    const ID_LENGTH = 12
    let id: string = ""
    for (let i = 0; i < ID_LENGTH; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length))
    }
    if (id in this.channels) {
      return this.generateId()
    }
    return id
  }

  _postChannels (req: express.Request, res: express.Response) {
    const isUseful = (candidate: any): boolean => {
      return candidate.includes("passive") && candidate.includes(this.ip)
    }
    const pc1 = new wrtc.RTCPeerConnection({
      iceServers: [ { urls: "stun:stun.l.google.com:19302" } ]
    })

    const channelId = this.generateId()
    this.channels[channelId] = {
      id: channelId,
      pc: pc1,
      status: Statuses.WAITING_FOR_ANSWER,
      dc: null
    }
    const channel: Channel = this.channels[channelId]

    const iceCandidates: IceCandidate[] = []
    const iceCandidateDeferred = Q.defer()
    let localDescription: any
    const localDescriptionDeferred = Q.defer()

    pc1.onicecandidate = (candidate: any) => {
      if (!candidate.candidate) {
        iceCandidateDeferred.resolve()
      } else {
        const iceCandidate: IceCandidate = {
          sdpMLineIndex: candidate.candidate.sdpMLineIndex,
          candidate: candidate.candidate.candidate
        }
        if (isUseful(candidate.candidate.candidate)) {
          console.log(`${channelId} pc1.onicecandidate`, JSON.stringify(iceCandidate))
          iceCandidates.push(iceCandidate)
        } 
      }
    }

    const dc1 = channel.dc = pc1.createDataChannel("test")
    channel.dc.onopen = () => {
        console.log(`${channelId} pc1: data channel open`)
        channel.status = Statuses.CHANNEL_ESTABLISHED,
        dc1.onmessage = (event: any) => {
          this.emit("data", event.data, channel)
        }
    }

    createOffer1()

    Promise.all([
        iceCandidateDeferred.promise,
        localDescriptionDeferred.promise
    ]).then(() => {
        res.status(200).json({
            success: true,
            channel_id: channelId,
            offer: localDescription,
            ice_candidates: iceCandidates,
        })
    })

    function setRemoteDescription2(desc: any) {
      localDescription = desc
      localDescriptionDeferred.resolve()
    }   

    function setLocalDescription1(desc: any) {
        console.log(`${channelId} pc1: set local description`)
        pc1.setLocalDescription(
            new wrtc.RTCSessionDescription(desc),
            setRemoteDescription2.bind(null, desc),
            handleError
        )
    }

    function createOffer1() {
        console.log(`${channelId} pc1: create offer`)
        pc1.createOffer(setLocalDescription1, handleError)
    }

    function handleError (error: any) {
      res.status(500).json({
        success: false,
        error: error
      })
    }
  }

  _postChannelAnswer (req: express.Request, res: express.Response) {
    let channel = this.channelCheck(req, res)
    if (!channel) return

    if (channel.status !== Statuses.WAITING_FOR_ANSWER) {
        res.status(400).json({
            success: false,
            reason: "channel is not waiting for answer"
        })
    }

    function setRemoteDescription1(desc: any) {
      if (!channel) {
        throw new Error("channel null")
      }
      console.log(`${channel.id} pc1: set remote description`)
      channel.status = Statuses.ANSWERED,
      channel.pc.setRemoteDescription(
          new wrtc.RTCSessionDescription(desc),
          () => {
              res.status(200).json({
                  success: true
              })
          },
          handleError
      )
    }

    function handleError (error: any) {
      res.status(500).json({
        success: false,
        error: error
      })
    }

    // ignore remote ice candidates
    function addIceCandidates(iceCandidates: IceCandidate[]) {
      if (!channel) {
        throw new Error("channel null")
      }
      const channelId = channel.id
      iceCandidates.forEach((iceCandidate: IceCandidate) => {
        console.log(`${channelId} pc1: adding ice candidate`, JSON.stringify(iceCandidate))
      })
    }

    setRemoteDescription1(req.body.answer)
    addIceCandidates(req.body.ice_candidates)
  }

  channelCheck(req: express.Request, res: express.Response) {
    const channelId = req.params.channelId
    if (!(channelId in this.channels)) {
        res.status(404).json({
            success: false,
            reason: "channel not found"
        })
        return null
    }
    return this.channels[channelId]
  }

  _postChannelClose (req: express.Request, res: express.Response) {
    const channel = this.channelCheck(req, res)
    if (!channel) return
    console.log(`${channel.id} pc1: close`)
    channel.pc.close()
    this.emit("closed", channel.id)
    delete this.channels[channel.id]
    return res.status(200).send({
        success: true
    })
  }
}
