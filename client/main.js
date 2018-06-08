var pc2;
var dc2;
var channelData;
var iceCandidates;
var iceCandidateDeferred;

function connect() {
    pc2 = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
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
            console.log(`${channelData.channel_id} pc2.onicecandidate`, JSON.stringify(iceCandidate));
            iceCandidates.push(iceCandidate);
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

    $.post("http://localhost:3000/channels").then(data => {
        console.log("connect", data);
        channelData = data;
        setRemoteDescription2(data.offer);
        for (let i in data.ice_candidates) {
            let iceCandidate = data.ice_candidates[i];
            console.log(`${channelData.channel_id} adding ice candidate`, JSON.stringify(iceCandidate)); 
            pc2.addIceCandidate(new RTCIceCandidate(iceCandidate));
        }
    }).fail(error => {
        console.error("connect", error);
    })
}

function send() {
    dc2.send($("#text-input").val());
}

function stop() {
    $.post(`http://localhost:3000/channels/${channelData.channel_id}/close`)
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
    console.log(`${channelData.channel_id} pc1: set remote description`);
    iceCandidateDeferred.then(() => {
        $.post({
            url: `http://localhost:3000/channels/${channelData.channel_id}/answer`,
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
    console.log(`${channelData.channel_id} pc2: set local description`);
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
    console.log(`${channelData.channel_id} pc2: set remote description`);
    pc2.setRemoteDescription(
        new RTCSessionDescription(desc),       
        createAnswer2,
        handleError);
}

//pc2.addIceCandidate(candidate.candidate);