class WebRTCComponent {

  constructor(pageConfig, config, iceconfig) {
    navigator.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
      || window.msSpeechRecognition || window.oSpeechRecognition;

    this.peerConnCfg = iceconfig ? iceconfig : this.peerConnCfg
    this.pageConfig = pageConfig;

    var signalingServerConnection = new SignalingServerConnection(config);

    this.signalingServerConnection = signalingServerConnection;

    this.handleSignalingServerChannel(this.signalingServerConnection);
    this.pageReady(pageConfig);
  }


  handleSignalingServerChannel(signalingServerConnection) {
    signalingServerConnection.onopen = (event) => {
      this.onOpenHandle(event);
    }

    signalingServerConnection.onmessage = (event) => {
      this.onMessageHandle(event);
    };
  }

  pageReady(pageConfig) {
    // check browser WebRTC availability 
    if (navigator.mediaDevices.getUserMedia) {
      this.videoCallButton = document.getElementById(pageConfig.callButtonID);
      this.endCallButton = document.getElementById(pageConfig.endButtonID);
      this.localVideo = document.getElementById(pageConfig.localStreamID);
      this.remoteVideo = document.getElementById(pageConfig.remoteStreamID);
      this.videoCallButton.removeAttribute("disabled");
      this.videoCallButton.addEventListener("click", () => {
        this.executeWebRTCFlowOffer();
      });
      this.endCallButton.addEventListener("click", (evt) => {
        this.signalingServerConnection.send(JSON.stringify({ type: "close", closeConnection: true, room: this.pageConfig.roomID }));
        this.endCall();
      });
    } else {
      alert("Sorry, your browser does not support WebRTC!")
    }
  };

  async executeWebRTCFlowOffer(rtcConfiguration) {

    var rtcPeerConnection = new RTCPeerConnection(rtcConfiguration);

    this.addWebRTCEventListener(rtcPeerConnection);

    this.peerConn = rtcPeerConnection;
    
    rtcPeerConnection.addStream(await this.getLocalStream());

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


    this.sendOfferToSignalingServer(offer);

    return rtcPeerConnection;
  }

  async executeWebRTCFlowAnswer(offer, rtcConfiguration) {
    var rtcPeerConnection = new RTCPeerConnection(rtcConfiguration);

    this.addWebRTCEventListener(rtcPeerConnection);

    this.peerConn = rtcPeerConnection;
    
    rtcPeerConnection.addStream(await this.getLocalStream());
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

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

    this.sendAnswerToSignalingServer(answer);
  }

  async onMessageHandle(event) {

    var signal = JSON.parse(event.data);
    switch (signal.type) {
      case "sdp":
        // 从远程对等端接收RemoteDescription（sdp）
        console.log("Received SDP from remote peer.");
        console.log(signal.sdp);
        if (this.pageConfig.type == 'call') {
          if (signal.sdp.type == "answer") {
            this.peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else {
          if (signal.sdp.type == "offer") {
            this.executeWebRTCFlowAnswer(signal.sdp, this.peerConnCfg);
          }
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

  // handleSignalingServerChannel onOpenHandle
  onOpenHandle(event) {
    this.signalingServerConnection.send(JSON.stringify({ type: "create", room: this.pageConfig.roomID }));
  }

  async getLocalStream() {
    const constraints = window.constraints = {
      audio: false,
      video: true
    };
    try {
      // get the local stream, show it in the local video element and send it
      //const localstream = await navigator.mediaDevices.getUserMedia(constraints);
      const localstream = await navigator.mediaDevices.getDisplayMedia();
      this.localVideoStream = localstream;
      this.localVideo.srcObject = this.localVideoStream;
      return localstream;
    } catch (exception) {
      console.log(exception);
      alert(exception);
      throw exception;
    }
  }

  addWebRTCEventListener(rtcPeerConnection) {
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
      if (ev.currentTarget.connectionState === "disconnected") {
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

  }

  sendOfferToSignalingServer(offer) {
    // 将LocalDescription（sdp）发送给远程对等端
    console.log("将LocalDescription（sdp）发送给远程对等端");
    console.log(offer);
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: offer, room: this.pageConfig.roomID }));
  }

  sendAnswerToSignalingServer(answer) {
    // 将LocalDescription（sdp）发送给远程对等端
    console.log("answer sdp 发送给远程对等端");
    console.log(answer);
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: answer, room: this.pageConfig.roomID }));
  }

  receive_candidate(candidate) {
    // 从远程对等端接收远程对等端的候选地址（candidate）
    console.log("Received ICECandidate from remote peer.");
    console.log(candidate);
    this.peerConn.addIceCandidate(new RTCIceCandidate(candidate));
  }

  onIceCandidateHandler(evt) {
    if (!evt || !evt.candidate) {
      console.log("没有收集到candidate候选地址");
      console.log(evt);
      return;
    } else {
      console.log("收集到candidate候选地址：");
      console.log(evt);
      console.log("将收集到的candidate候选地址发送给远程对等端");
      this.signalingServerConnection.send(JSON.stringify({ type: "candidate", candidate: evt.candidate, room: this.pageConfig.roomID }));
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
WebRTCComponent.prototype.pageConfig = {
  type: 'call',
  roomID: 'room',
  id: 'id',
  callButtonID: 'local_button',
  endButtonID: 'end_button',
  localStreamID: 'local_stream',
  remoteStreamID: 'remote_stream'
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

class WebRTCDataChannelComponent {

  constructor(pageConfig, config, iceconfig) {
    window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
      || window.msSpeechRecognition || window.oSpeechRecognition;

    this.peerConnCfg = iceconfig ? iceconfig : this.peerConnCfg
    this.pageConfig = pageConfig;

    var signalingServerConnection = new SignalingServerConnection(config);

    this.signalingServerConnection = signalingServerConnection;
    this.pageReady(pageConfig);
    this.handleSignalingServerChannel(this.signalingServerConnection);
  }


  handleSignalingServerChannel(signalingServerConnection) {
    signalingServerConnection.onopen = (event) => {
      this.onOpenHandle(event);
    }

    signalingServerConnection.onmessage = (event) => {
      this.onMessageHandle(event);
    };
  }

  pageReady(pageConfig) {
    // check browser WebRTC availability 
    this.videoCallButton = document.getElementById(pageConfig.callButtonID);
    this.endCallButton = document.getElementById(pageConfig.endButtonID);
    this.videoCallButton.removeAttribute("disabled");
    this.videoCallButton.addEventListener("click", () => {
      this.call();
    });
    this.endCallButton.addEventListener("click", (evt) => {
      this.signalingServerConnection.send(JSON.stringify({ type: "close", closeConnection: true, room: this.pageConfig.roomID }));
      this.endCall();
    });
  };

  async call() {

    var rtcPeerConnection = this.createRTCPeerConnection(this.peerConnCfg);

    this.peerConn = rtcPeerConnection;

    this.dataChannel = this.createDataChannel(rtcPeerConnection);

    var offer = await this.createAndSetLocalOffer(rtcPeerConnection);

    this.sendOffer(offer);
  }

  createDataChannel(rtcPeerConnection) {
    var dataChannel = rtcPeerConnection.createDataChannel('sendDataChannel');

    this.ondatachannel(dataChannel);

    return dataChannel;
  }

  getDatachannel(rtcPeerConnection) {
    rtcPeerConnection.ondatachannel = (event) => {
      console.log('Receive Channel Callback');
      this.dataChannel = event.channel;
      this.ondatachannel(event.channel);
    };
  }

  ondatachannel(dataChannel) {
    dataChannel.onopen = (event) => {
      console.log('Sent Data: ' + event);
      this.onOpen(event);
    };

    dataChannel.onmessage = (event) => {
      console.log(event.data);
      this.onMessage(event);
    };

    dataChannel.onclose = (event) => {
      this.onClose(event);
    };
  }

  sendData(data) {
    this.dataChannel.send(data);
  }

  onOpen(event) {
  }

  onClose(event) {
  }

  onMessage(event) {
  }


  // handleSignalingServerChannel onOpenHandle
  onOpenHandle(event) {
    this.signalingServerConnection.send(JSON.stringify({ type: "create", room: this.pageConfig.roomID }));
  }
  // handleSignalingServerChannel onMessageHandle
  onMessageHandle(event) {

    var signal = JSON.parse(event.data);
    switch (signal.type) {
      case "sdp":
        // 从远程对等端接收RemoteDescription（sdp）
        console.log("Received SDP from remote peer.");
        console.log(signal.sdp);
        if (this.pageConfig.type == 'call') {
          if (signal.sdp.type == "answer") {
            this.peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else {
          if (signal.sdp.type == "offer") {
            this.receive_offer_sdp(signal.sdp, this.peerConnCfg);
          }
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

    rtcPeerConnection.onconnectionstatechange = (ev) => {
      console.log("connectionstatechange:");
      console.log(ev.currentTarget);
      if (ev.currentTarget.connectionState === "disconnected") {
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
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: offer, room: this.pageConfig.roomID }));
  }

  sendAnswer(answer) {
    // 将LocalDescription（sdp）发送给远程对等端
    console.log("answer sdp 发送给远程对等端");
    console.log(answer);
    this.signalingServerConnection.send(JSON.stringify({ type: "sdp", sdp: answer, room: this.pageConfig.roomID }));
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
    this.getDatachannel(rtcPeerConnection);

    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    this.peerConn = rtcPeerConnection;

    var answer = await this.createAnswerAndSetLocalSDP(rtcPeerConnection);

    this.sendAnswer(answer);
  }

  receive_candidate(candidate) {
    // 从远程对等端接收远程对等端的候选地址（candidate）
    console.log("Received ICECandidate from remote peer.");
    console.log(candidate);
    this.peerConn.addIceCandidate(new RTCIceCandidate(candidate));
  }

  onIceCandidateHandler(evt) {
    if (!evt || !evt.candidate) {
      console.log("没有收集到candidate候选地址");
      console.log(evt);
      return;
    } else {
      console.log("收集到candidate候选地址：");
      console.log(evt);
      console.log("将收集到的candidate候选地址发送给远程对等端");
      this.signalingServerConnection.send(JSON.stringify({ type: "candidate", candidate: evt.candidate, room: this.pageConfig.roomID }));
    }
  };

  endCall() {
    this.peerConn.close();
    this.peerConn = null;
    this.videoCallButton.removeAttribute("disabled");
    this.endCallButton.setAttribute("disabled", true);
  };

}

WebRTCDataChannelComponent.prototype.id;

WebRTCDataChannelComponent.prototype.localVideoElem = null;
WebRTCDataChannelComponent.prototype.remoteVideoElem = null;
WebRTCDataChannelComponent.prototype.videoCallButton = null;
WebRTCDataChannelComponent.prototype.endCallButton = null;
WebRTCDataChannelComponent.prototype.peerConn = null;
WebRTCDataChannelComponent.prototype.wsc = null;//new WebSocket(this.config.wssHost);
WebRTCDataChannelComponent.prototype.peerConnCfg = {
  'iceServers':
    [{ 'url': 'stun:stun.services.mozilla.com' },
    { 'url': 'stun:stun.l.google.com:19302' }]
};
WebRTCDataChannelComponent.prototype.pageConfig = {
  type: 'call',
  roomID: 'room',
  id: 'id',
  callButtonID: 'local_button',
  endButtonID: 'end_button'
};
WebRTCDataChannelComponent.prototype.signalingServerConnection = null;

WebRTCDataChannelComponent.prototype.innerHTML = `
  <input id="videoCallButton" type="button" disabled value="Video Call"/>
  <input id="endCallButton" type="button" disabled value="End Call"/>
`;
WebRTCDataChannelComponent.prototype.dataChannel = null;


WebRTCDataChannelComponent.decorators = [
  {
    args: [{
      selector: 'lib-webrtc-lib',
      template: `
  <input id="videoCallButton" type="button" disabled value="Video Call"/>
  <input id="endCallButton" type="button" disabled value="End Call"/>
  <script>window.addEventListener("load", pageReady);</script>
  `
    }]
  }
];
/** @nocollapse */
WebRTCDataChannelComponent.ctorParameters = () => [];

class SignalingServerConnection {

  constructor(config) {
    this.config = config ? config : this.config;

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

  onopen(event) {
    console.log(event);
    return event;
  }

  onerror(event) {
    console.log(event);
    return event;
  }

  onclose(event) {
    console.log(event);
    return event;
  }

  onmessage(event) {
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
exports.WebRTCDataChannelComponent = WebRTCDataChannelComponent;
exports.SignalingServerConnection = SignalingServerConnection;