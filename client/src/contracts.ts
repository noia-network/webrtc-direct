interface ChannelData {
    channel_id: string;
    ice_candidates: RTCIceCandidate[];
    offer: RTCSessionDescription;
}
