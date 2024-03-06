class WebRTCComponent {

  constructor(id, config, iceconfig) {
    navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
            || window.msSpeechRecognition || window.oSpeechRecognition;

    this.id = document.getElementById(id);
    this.config = config? config: this.config;
    this.peerConnCfg = iceconfig? iceconfig: this.peerConnCfg
  }

  init(roomid) {
    this.room = roomid;//prompt('Enter room name:'); //弹出一个输入窗口

    this.wsc = new WebSocket(this.config.wssHost);

    this.wsc.onopen = () => {
      this.wsc.send(JSON.stringify({ type: "create", room: this.room }));
    }

    this.wsc.onmessage = (evt) => {
      var signal = null;
      if (!this.peerConn) this.answerCall();
      signal = JSON.parse(evt.data);
      if (signal.sdp) {
        console.log("Received SDP from remote peer.");
        this.peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }
      else if (signal.candidate) {
        console.log("Received ICECandidate from remote peer.");
        this.peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } else if (signal.closeConnection) {
        console.log("Received 'close call' signal from remote peer.");
        this.endCall();
      }
    };

    this.id.innerHTML = this.innerHTML;
    this.pageReady();
  }

  pageReady() {
    // check browser WebRTC availability 
    if (navigator.getUserMedia) {
      this.videoCallButton = document.getElementById("videoCallButton");
      this.endCallButton = document.getElementById("endCallButton");
      this.localVideo = document.getElementById(this.localVideoId);
      this.remoteVideo = document.getElementById(this.remoteVideoId);
      this.videoCallButton.removeAttribute("disabled");
      this.videoCallButton.addEventListener("click", () => {
        this.initiateCall();
      });
      this.endCallButton.addEventListener("click", (evt) => {
        this.wsc.send(JSON.stringify({ type: "close", closeConnection: true, room: this.room }));
        this.endCall();
      });
    } else {
      alert("Sorry, your browser does not support WebRTC!")
    }
  };

  prepareCall() {
    this.peerConn = new RTCPeerConnection(this.peerConnCfg);
    // send any ice candidates to the other peer
    this.peerConn.onicecandidate = (evt) => {
      this.onIceCandidateHandler(evt);
    };
    // once remote stream arrives, show it in the remote video element
    this.peerConn.onaddstream = (evt) => {
      this.onAddStreamHandler(evt);
    };
    this.peerConn.onconnectionstatechange = (ev) => {
      if(ev.currentTarget.connectionState === "disconnected"){
        this.endCall();
      }
    }
  };

  // run start(true) to initiate a call
  initiateCall() {
    this.prepareCall();
    // get the local stream, show it in the local video element and send it
    navigator.getUserMedia({ "audio": false, "video": true },  (stream) => {
      this.localVideoStream = stream;
      this.localVideo.srcObject = this.localVideoStream;
      this.peerConn.addStream(this.localVideoStream);
      this.createAndSendOffer();
    }, (error) => { console.log(error); });
  };

  answerCall() {
    this.prepareCall();
    // get the local stream, show it in the local video element and send it
    navigator.getUserMedia({ "audio": false, "video": true },  (stream) => {
        this.localVideoStream = stream;
        this.localVideo.srcObject = this.localVideoStream;
        this.peerConn.addStream(this.localVideoStream);
        this.createAndSendAnswer();
    }, function (error) { console.log(error); });
  };

  createAndSendOffer() {
    this.peerConn.createOffer(
      (offer) => {
        var off = new RTCSessionDescription(offer);
        this.peerConn.setLocalDescription(new RTCSessionDescription(off),
          () => {
            this.wsc.send(JSON.stringify({ type: "sdp", sdp: off, room: this.room}));
          },
          function (error) { console.log(error); }
        );
      },
      function (error) { console.log(error); }
    );
  };

  createAndSendAnswer() {
    this.peerConn.createAnswer(
      (answer) => {
        var ans = new RTCSessionDescription(answer);
        this.peerConn.setLocalDescription(ans,  () => {
            this.wsc.send(JSON.stringify({ type: "sdp", sdp: ans, room: this.room }));
        },
          function (error) { console.log(error); }
        );
      },
      function (error) { console.log(error); }
    );
  };

  onIceCandidateHandler(evt) {
    if (!evt || !evt.candidate) return;
    this.wsc.send(JSON.stringify({ type: "candidate", candidate: evt.candidate, room: this.room }));
  };
  
  onAddStreamHandler(evt) {
    this.videoCallButton.setAttribute("disabled", true);
    this.endCallButton.removeAttribute("disabled");
    // set remote video stream as source for remote video HTML5 element
    this.remoteVideo.srcObject = evt.stream;
  };

  endCall() {
    this.peerConn.close();
    this.peerConn = null;
    this.videoCallButton.removeAttribute("disabled");
    this.endCallButton.setAttribute("disabled", true);
    if (this.localVideoStream) {
        this.localVideoStream.getTracks().forEach(function (track) {
        track.stop();
      });
      this.localVideo.src = "";
    }
    if (this.remoteVideo) this.remoteVideo.src = "";
  };

  setLocalVideoId(id) {
    this.localVideoId = id;
  }

  setremoteVideoId(id) {
    this.remoteVideoId = id
  }
}

WebRTCComponent.prototype.id;

WebRTCComponent.prototype.room;
WebRTCComponent.prototype.config = {
  wssHost: 'wss://moly.ngrok2.xiaomiqiu.cn/signaling'
  // wssHost: 'wss://example.com/myWebSocket'
};
WebRTCComponent.prototype.localVideoElem = null;
WebRTCComponent.prototype.remoteVideoElem = null;
WebRTCComponent.prototype.localVideoId = "localVideo";
WebRTCComponent.prototype.remoteVideoId = "remoteVideo";
WebRTCComponent.prototype.localVideoStream = null;
WebRTCComponent.prototype.videoCallButton = null;
WebRTCComponent.prototype.endCallButton = null;
WebRTCComponent.prototype.peerConn = null;
WebRTCComponent.prototype.wsc = null;//new WebSocket(this.config.wssHost);
WebRTCComponent.prototype.peerConnCfg = {
    'iceServers':
      [{ 'url': 'stun:stun.services.mozilla.com' },
      { 'url': 'stun:stun.l.google.com:19302' }]
};

WebRTCComponent.prototype.innerHTML = `
  <video id="remoteVideo" autoplay></video>
  <video id="localVideo" autoplay muted></video>
  <input id="videoCallButton" type="button" disabled value="Video Call"/>
  <input id="endCallButton" type="button" disabled value="End Call"/>
`;


WebRTCComponent.decorators = [
    {
        args: [{
            selector: 'lib-webrtc-lib',
            template: `
  <video id="remoteVideo" autoplay></video>
  <video id="localVideo" autoplay muted></video>
  <input id="videoCallButton" type="button" disabled value="Video Call"/>
  <input id="endCallButton" type="button" disabled value="End Call"/>
  <script>window.addEventListener("load", pageReady);</script>
  `
        }]
    }
];
/** @nocollapse */
WebRTCComponent.ctorParameters = () => [];


exports.WebRTCComponent = WebRTCComponent;