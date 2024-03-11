class WebRTCComponent {

  constructor(id, config, iceconfig, signalingServerConnection) {
    navigator.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
            || window.msSpeechRecognition || window.oSpeechRecognition;

    this.id = document.getElementById(id);
    this.config = config? config: this.config;
    this.peerConnCfg = iceconfig? iceconfig: this.peerConnCfg
    this.signalingServerConnection = signalingServerConnection;
  }

  create_call_ws(roomid) {
    this.room = roomid;//prompt('Enter room name:'); //弹出一个输入窗口

    //var wsc = new WebSocket(this.config.wssHost);

    this.signalingServerConnection.onopen = () => {
      this.signalingServerConnection.send(JSON.stringify({ type: "create", room: this.room }));
    }

    this.signalingServerConnection.onmessage = (evt) => {
      var signal = JSON.parse(evt.data);
      switch(signal.type) {
        case "sdp":
          // 从远程对等端接收RemoteDescription（sdp）
          console.log("Received SDP from remote peer.");
          console.log(signal.sdp);
          if (signal.sdp.type == "answer") {
            this.peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
          break;
        case "candidate":
          // 从远程对等端接收远程对等端的候选地址（candidate）
          this.receive_candidate(signal.candidate);
          break;
        case "close":
          console.log("Received 'close call' signal from remote peer.");
          this.endCall();
          break;
        default:
          break;
      }
    };
    //this.signalingServerConnection = signalingServerConnection;
    this.id.innerHTML = this.innerHTML;
    this.pageReady();
  }

  create_receive_ws(roomid) {
    this.room = roomid;//prompt('Enter room name:'); //弹出一个输入窗口

    //var wsc = new WebSocket(this.config.wssHost);

    this.signalingServerConnection.onopen = () => {
      this.signalingServerConnection.send(JSON.stringify({ type: "create", room: this.room }));
    }

    this.signalingServerConnection.onmessage = (evt) => {
      var signal = JSON.parse(evt.data);
      switch(signal.type) {
        case "sdp":
          // 从远程对等端接收RemoteDescription（sdp）
          console.log("Received SDP from remote peer.");
          console.log(signal.sdp);
          if (signal.sdp.type == "offer") {
            this.receive_offer_sdp(signal.sdp, this.peerConnCfg);
          }
          break;
        case "candidate":
          // 从远程对等端接收远程对等端的候选地址（candidate）
          this.receive_candidate(signal.candidate);
          break;
        case "close":
          console.log("Received 'close call' signal from remote peer.");
          this.endCall();
          break;
        default:
          break;
      }
    };
    //this.wsc = wsc;
    this.id.innerHTML = this.innerHTML;
    this.pageReady();
  }

  async getLocalStream(constraints) {
    try {
      // get the local stream, show it in the local video element and send it
      const localstream = await navigator.mediaDevices.getUserMedia(constraints);
      return localstream;
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }
  }

  createRTCPeerConnection(rtcConfiguration) {

    var rtcPeerConnection = new RTCPeerConnection(rtcConfiguration);

    // 收集candidates（候选地址）
    // 客户端获取本地host地址（type：host）
    // 客户端从STUN服务器获取srflx地址（type：srflx）
    // 客户端从TURN服务器获取中继地址（type：relay）TODO
    // candidates（候选地址）收集完成后回调此方法
    // send any ice candidates to the other peer
    rtcPeerConnection.onicecandidate = (evt) => {
      this.onIceCandidateHandler(evt);
    };

    rtcPeerConnection.onicecandidateerror = (evt) => {
      console.log("onicecandidateerror:");
      console.log(evt);
    };

    // remotestream远程数据流到达时，回调此方法
    // once remote stream arrives, show it in the remote video element
    rtcPeerConnection.onaddstream = (evt) => {
      this.onAddStreamHandler(evt);
    };

    rtcPeerConnection.onconnectionstatechange = (ev) => {
      console.log("connectionstatechange:");
      console.log(ev.currentTarget);
      if(ev.currentTarget.connectionState === "disconnected"){
        this.endCall();
      }
    }

    rtcPeerConnection.oniceconnectionstatechange = (evt) => {
      console.log("oniceconnectionstatechange:");
      console.log(evt);
    };

    rtcPeerConnection.onicegatheringstatechange = (evt) => {
      console.log("onicegatheringstatechange:");
      console.log(evt);
    };

    rtcPeerConnection.onsignalingstatechange = (evt) => {
      console.log("onsignalingstatechange:");
      console.log(evt);
    };

    rtcPeerConnection.onsignalingstatechange = (evt) => {
      console.log("onsignalingstatechange:");
      console.log(evt);
    };

    return rtcPeerConnection;
  }

  async createAndSetLocalOffer(rtcPeerConnection) {
    var offerRTCSessionDescriptionInit;
    try {
      offerRTCSessionDescriptionInit = await rtcPeerConnection.createOffer();
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }

    var offer = new RTCSessionDescription(offerRTCSessionDescriptionInit);
    try {
      await rtcPeerConnection.setLocalDescription(offer);
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }

    return offer;
  };

  sendOffer(offer) {
    // 将LocalDescription（sdp）发送给远程对等端
    console.log("将LocalDescription（sdp）发送给远程对等端");
    console.log(offer);
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: offer, room: this.room}));
  }

  sendAnswer(answer) {
    // 将LocalDescription（sdp）发送给远程对等端
    console.log("answer sdp 发送给远程对等端");
    console.log(answer);
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: answer, room: this.room }));
  }

  async call() {

    var rtcPeerConnection = this.createRTCPeerConnection(this.peerConnCfg);

    this.peerConn = rtcPeerConnection;

    const constraints = window.constraints = {
      audio: false,
      video: true
    };

    const localstream = await this.getLocalStream(constraints);
    rtcPeerConnection.addStream(localstream);

    this.localVideoStream = localstream;
    this.localVideo.srcObject = this.localVideoStream;

    var offer = await this.createAndSetLocalOffer(rtcPeerConnection);

    this.sendOffer(offer);
  }

  async createAnswerAndSetLocalSDP(rtcPeerConnection) {

    var answerRTCSessionDescriptionInit;
    try {
      answerRTCSessionDescriptionInit = await rtcPeerConnection.createAnswer();
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }

    var answer = new RTCSessionDescription(answerRTCSessionDescriptionInit);
    try {
      await rtcPeerConnection.setLocalDescription(answer);
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }

    return answer;
  };

  async receive_offer_sdp(offer, rtcConfiguration) {

    var rtcPeerConnection = this.createRTCPeerConnection(rtcConfiguration);

    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    this.peerConn = rtcPeerConnection;

    const constraints = window.constraints = {
      audio: false,
      video: true
    };

    const localstream = await this.getLocalStream(constraints);

    this.localVideoStream = localstream;
    this.localVideo.srcObject = this.localVideoStream;

    rtcPeerConnection.addStream(localstream);

    var answer = await this.createAnswerAndSetLocalSDP(rtcPeerConnection);

    this.sendAnswer(answer);
  }

  receive_candidate(candidate) {
    // 从远程对等端接收远程对等端的候选地址（candidate）
    console.log("Received ICECandidate from remote peer.");
    console.log(candidate);
    this.peerConn.addIceCandidate(new RTCIceCandidate(candidate));
  }
  ws_receive_onmessage(evt) {
    var signal = JSON.parse(evt.data);
    switch(signal.type) {
      case "sdp":
        // 从远程对等端接收RemoteDescription（sdp）
        console.log("Received SDP from remote peer.");
        console.log(signal.sdp);
        if (signal.sdp.type == "offer") {
          this.receive_offer_sdp(signal.sdp, this.peerConnCfg);
        }
        break;
      case "candidate":
        // 从远程对等端接收远程对等端的候选地址（candidate）
        this.receive_candidate(signal.candidate);
        break;
      case "close":
        console.log("Received 'close call' signal from remote peer.");
        this.endCall();
        break;
      default:
        break;
    }
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
        this.call();
      });
      this.endCallButton.addEventListener("click", (evt) => {
        this.signalingServerConnection.send(JSON.stringify({ type: "close", closeConnection: true, room: this.room }));
        this.endCall();
      });
    } else {
      alert("Sorry, your browser does not support WebRTC!")
    }
  };

  onIceCandidateHandler(evt) {
    if (!evt || !evt.candidate) {
      console.log("没有收集到candidate候选地址");
      console.log(evt);
      return;
    } else{
      console.log("收集到candidate候选地址：");
      console.log(evt);
      console.log("将收集到的candidate候选地址发送给远程对等端");
      this.signalingServerConnection.send(JSON.stringify({ type: "candidate", candidate: evt.candidate, room: this.room }));
    }
  };
  
  onAddStreamHandler(evt) {
    console.log("remotestream远程数据流到达");
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
WebRTCComponent.prototype.signalingServerConnection = null;

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

class SignalingServerConnection {

  constructor(config) {
    this.config = config? config: this.config;

    this.room = config.roomid;//prompt('Enter room name:'); //弹出一个输入窗口

    var wsc = new WebSocket(this.config.wssHost);

    wsc.onopen = (event) => {
      console.log(event);
      this.onopen(event);
      return event;
    }
    wsc.onclose = (event) => {
      console.log(event);
      this.onclose();
      return event;
    }
    wsc.onmessage = (event) => {
      console.log(event);
      this.onmessage(event);
      return event;
    }
    wsc.onerror = (event) => {
      console.log(event);
      this.onerror(event)
      return event;
    }

    this.wsc = wsc;
  }

  onopen = (event) => {
    console.log(event);
    return event;
  }

  onerror = (event) => {
    console.log(event);
    return event;
  }

  onclose = (event) => {
    console.log(event);
    return event;
  }

  onmessage = (event) => {
    console.log(event);
    return event;
  }
  send(msg) {
    this.wsc.send(msg);
  }
}

SignalingServerConnection.prototype.wsc = null;

SignalingServerConnection.prototype.config = {
  wssHost: 'wss://moly.ngrok2.xiaomiqiu.cn/signaling'
};


exports.WebRTCComponent = WebRTCComponent;
exports.SignalingServerConnection = SignalingServerConnection;