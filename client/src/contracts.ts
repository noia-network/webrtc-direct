interface ChannelData {
    success: boolean;
    channelId: string;
    iceCandidates: RTCIceCandidate[];
    offer: RTCSessionDescription;
}
