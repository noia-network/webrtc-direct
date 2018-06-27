var pc2;
var dc2;
var channelData;
var iceCandidates;
var iceCandidateDeferred;
var portToReplace

const address = `localhost:3000`
const CONTROL_PORT = "60123"

function connect() {
    const isUDP = (candidate) => {
        return candidate.includes("UDP")
    }
    pc2 = new RTCPeerConnection();

    pc2.onnegotationneeded = (event) => {
        console.log(`negotation-needed`, event)
    }
    pc2.onicecandidateerror = (event) => {
        console.log(`ice-candidate`, event)
    }
    pc2.onsignalingstatechange = (event) => {
        console.log(`signaling-state`, pc2.signalingState)
    }
    pc2.oniceconnectionstatechange = (event) => {
        console.log(`ice-connection-state`, pc2.iceConnectionState)
    }
    pc2.onicegatheringstatechange = (event) => {
        console.log(`ice-gathering-state`, pc2.iceGatheringState)
    }
    pc2.onconnectionstatechange = (event) => {
        console.log(`connection-state`, pc2.connectionState)
    }

    iceCandidates = [];
    iceCandidateDeferred = $.Deferred();

    pc2.onicecandidate = function(candidate) {
        if (!candidate.candidate) {
            iceCandidateDeferred.resolve();
        } else {
            var iceCandidate = {
                sdpMLineIndex: candidate.candidate.sdpMLineIndex,
                candidate: candidate.candidate.candidate
            }

            if (isUDP(iceCandidate.candidate)) {
                console.log(`${channelData.channel_id} pc2.onicecandidate (before)`, JSON.stringify(iceCandidate));
                iceCandidates.push(iceCandidate);
            }
        }
    };

    var checks = 0;
    var expected = 10;
    pc2.ondatachannel = function(event) {
        dc2 = event.channel;
        dc2.onopen = function() {
            console.log("pc2: data channel open");
            dc2.onmessage = function(event) {
                var data = event.data;
                $("#received-texts").append(data + "\n");
            };
        };
    };

    $.post(`http://${address}/channels`).then(data => {
        console.log("connect", data);
        channelData = data;
        setRemoteDescription2(data.offer);
        data.ice_candidates.forEach((iceCandidate) => {
            console.log(`${channelData.channel_id} adding remote ice candidates`, JSON.stringify(iceCandidate)); 
            pc2.addIceCandidate(new RTCIceCandidate(iceCandidate));
        })
    }).fail(error => {
        console.error("connect", error);
    })
}

function send() {
    const text = JSON.stringify({
        "infoHash": "ebb52b53ff9459dacb8ab814144416e7164e06df",
        "piece": 0,
        "offset": 0,
        "length": 0
    })
    dc2.send(text);
    // dc2.send($("#text-input").val());
}

function stop() {
    $.post(`http://${address}/channels/${channelData.channel_id}/close`)
    .then(result => {
        console.log(`${channelData.channel_id} closed`, result);
    }).fail(error => {
        console.error(`${channelData.channel_id} closed, error =`, error);
    });
}

function handleError(error) {
    console.log("error", error);
}

function setRemoteDescription1(desc) {
    console.log(`${channelData.channel_id} pc2: set remote description1 (send to node)`, desc.type, desc.sdp);
    iceCandidateDeferred.then(() => {
        $.post({
            url: `http://${address}/channels/${channelData.channel_id}/answer`,
            data: JSON.stringify({
                answer: desc,
                ice_candidates: iceCandidates
            }),
            contentType: "application/json"
        }).then(result => {
            console.log(`${channelData.channel_id} setRemoteDescription1`, result);
        }).fail(error => {
            console.error(`${channelData.channel_id} setRemoteDescription1`, error);
        });
    }).fail(error => {
        console.error(`${channelData.channel_id} setRemoteDescription1`, error);
    });
}

function setLocalDescription2(desc) {
    console.log(`${channelData.channel_id} pc2: set local description`, desc.type, desc.sdp);
    pc2.setLocalDescription(
        new RTCSessionDescription(desc),
        setRemoteDescription1.bind(null, desc),
        handleError
    );
}

function createAnswer2() {
    console.log(`${channelData.channel_id} pc2: create answer`);
    pc2.createAnswer(
        setLocalDescription2,
        handleError
    );
}

function setRemoteDescription2(desc) {
    console.log(`${channelData.channeisUsefull_id} pc2: set remote description`, desc.type, desc.sdp);
    pc2.setRemoteDescription(
        new RTCSessionDescription(desc),       
        createAnswer2,
        handleError);
}
