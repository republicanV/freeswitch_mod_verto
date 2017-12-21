import ErrorFSRTC from './errors/ErrorFSRT';
import Adapters from './adapters';
import {CHROME, FIREFOX, ANDROID, IE, IOS, OPERA, SAFARI} from './constants/browserName'
// import 'verto';

/**
 * FREESWITCH RTC Class
 */
class FSRTC {
    /**
     *
     * @type {{SDP: null, profile: {}, candidateList: Array}}
     */
    mediaData = {
        SDP: null,
        profile: {},
        candidateList: []
    };
    /**
     *
     * @type {boolean}
     */
    audioEnabled = true;
    /**
     *
     * @type {boolean}
     */
    videoEnabled = true;
    /**
     *
     * @type {
     *     {
     *          useVideo: null,
     *          useStereo: boolean,
     *          userData: null,
     *          localVideo: null,
     *          screenShare: boolean,
     *          useCamera: string,
     *          iceServers: boolean,
     *          videoParams: {},
     *          audioParams: {},
     *          callbacks: {
     *              onICEComplete: FSRTC.options.callbacks.onICEComplete,
     *              onICE: FSRTC.options.callbacks.onICE,
     *              onOfferSDP: FSRTC.options.callbacks.onOfferSDP
     *          }
     *      }
     * }
     */
    options = {
        useVideo : null,
        useStereo : false,
        userData : null,
        localVideo : null,
        screenShare : false,
        useCamera : "any",
        iceServers : false,
        videoParams : {},
        audioParams : {},
        callbacks : {
            onICEComplete :  function() {},
            onICE :  function() {},
            onOfferSDP :  function() {}
        },
    };

    /**
     *
     */
    adapter;

    /**
     *
     * @param options
     * @param browserDetect
     */
    constructor(options = {}, browserDetect = null) {
        if(browserDetect === null) throw new ErrorFSRTC('No detect browser name');
        /**
         *
         */
        this.adapter = FSRTC.getAdapter(browserDetect);
        /**
         *
         * @type {{useVideo: null, useStereo: boolean, userData: null, localVideo: null, screenShare: boolean, useCamera: string, iceServers: boolean, videoParams: {}, audioParams: {}, callbacks: {onICEComplete: FSRTC.options.callbacks.onICEComplete, onICE: FSRTC.options.callbacks.onICE, onOfferSDP: FSRTC.options.callbacks.onOfferSDP}}}
         */
        this.options = {...this.options, ...options, constraints : this.adapter.constraints};

        console.log(this.options, this.adapter.getClassName(),'this.adapter.constraints:===>',this.adapter.constraints, browserDetect);
    }

    /**
     *
     * @param adapterObj
     * @returns {BaseAdapter}
     */
    static getAdapter(adapterObj) {

        switch (adapterObj.name) {
            case CHROME :
                return new Adapters.Chrome();
            case FIREFOX :
                return new Adapters.Mozilla();
            case IE :
                return new Adapters.InternetExplorer();
        }

        return new Adapters.BaseAdapter();

    };

    /**
     *
     * @type {Array}
     */
    validRes = [];

    /**
     *
     * @param obj
     * @param local
     */
    useVideo(obj, local) {

        if (obj) {
            this.options.useVideo = obj;
            this.options.localVideo = local;
            this.options.constraints.offerToReceiveVideo = true;
        } else {
            this.options.useVideo = null;
            this.options.localVideo = null;
            this.options.constraints.offerToReceiveVideo = false;
        }

        if (this.options.useVideo) {
            this.options.useVideo.style.display = 'none';
        }
    };

    useStereo(on) {
        this.options.useStereo = on;
    };

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    static findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        const realEndLine = (endLine !== -1) ? endLine : sdpLines.length;
        for (let i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr || sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    };

    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    findLine(sdpLines, prefix, substr) {
        return this.findLineInRange(sdpLines, 0, -1, prefix, substr);
    };

    // Gets the codec payload type from an a=rtpmap:X line.
    getCodecPayloadType(sdpLine) {
        const pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
        const result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
    };

    // Returns a new m= line with the specified codec as the first one.
    setDefaultCodec(mLine, payload) {
        const elements = mLine.split(' ');
        let newLine = [];
        let index = 0;
        for (let i = 0; i < elements.length; i++) {
            if (index === 3) { // Format of media starts from the fourth.
                newLine[index++] = payload; // Put target payload to the first.
            }
            if (elements[i] !== payload) newLine[index++] = elements[i];
        }
        return newLine.join(' ');
    };

    stereoHack (sdp) {

        if (!this.options.useStereo) {
            return sdp;
        }

        const sdpLines = sdp.split('\r\n');

        // Find opus payload.
        let opusIndex = this.findLine(sdpLines, 'a=rtpmap', 'opus/48000'), opusPayload;

        if (!opusIndex) {
            return sdp;
        } else {
            opusPayload = this.getCodecPayloadType(sdpLines[opusIndex]);
        }

        // Find the payload in fmtp line.
        const fmtpLineIndex = this.findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());

        if (fmtpLineIndex === null) {
            // create an fmtp line
            sdpLines[opusIndex] = sdpLines[opusIndex] +
                '\r\na=fmtp:' + opusPayload.toString() +
                " stereo=1; sprop-stereo=1"
        } else {
            // Append stereo=1 to fmtp line.
            sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; stereo=1; sprop-stereo=1');
        }

        sdp = sdpLines.join('\r\n');
        return sdp;
    };

    setCompat() {
    };

    checkCompat() {
        return true;
    };

    doCallback(self, func, arg) {
        if (func in self.options.callbacks) {
            self.options.callbacks[func](self, arg);
        }
    };

    onStreamError(self, e) {
        console.log('There has been a problem retrieving the streams - did you allow access? Check Device Resolution', e);
        this.doCallback(self, "onError", e);
    };

    onStreamSuccess(self, stream) {
        console.log("Stream Success");
        this.doCallback(self, "onStream", stream);
    };

    onICE(self, candidate) {
        self.mediaData.candidate = candidate;
        self.mediaData.candidateList.push(self.mediaData.candidate);

        this.doCallback(self, "onICE");
    };

    onICEComplete(self, candidate) {
        console.log("ICE Complete");
        this.doCallback(self, "onICEComplete");
    };

    onChannelError(self, e) {
        console.error("Channel Error", e);
        this.doCallback(self, "onError", e);
    };

    onICESDP(self, sdp) {
        self.mediaData.SDP = self.stereoHack(sdp.sdp);
        console.log("ICE SDP");
        this.doCallback(self, "onICESDP");
    };

    onAnswerSDP(self, sdp) {
        self.answer.SDP = self.stereoHack(sdp.sdp);
        console.log("ICE ANSWER SDP");
        this.doCallback(self, "onAnswerSDP", self.answer.SDP);
    };

    onMessage(self, msg) {
        console.log("Message");
        this.doCallback(self, "onICESDP", msg);
    };

    FSRTCattachMediaStream = function(element, stream) {
        if (typeof element.srcObject !== 'undefined') {
            element.srcObject = stream;
        } else if (typeof element.src !== 'undefined') {
            element.src = URL.createObjectURL(stream);
        } else {
            console.error('Error attaching stream to element.');
        }
    };

    onRemoteStream(self, stream) {
        if (self.options.useVideo) {
            self.options.useVideo.style.display = 'block';

            // Hacks for Mobile Safari
            const iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

            if (iOS) {
                self.options.useVideo.setAttribute("playsinline", true);
                self.options.useVideo.setAttribute("controls", true);
            }
        }

        const element = self.options.useAudio;
        console.log("REMOTE STREAM", stream, element);

        this.FSRTCattachMediaStream(element, stream);

        //self.options.useAudio.play();
        self.remoteStream = stream;
    };

    onOfferSDP(self, sdp) {
        self.mediaData.SDP = self.stereoHack(sdp.sdp);
        console.log("Offer SDP");
        this.doCallback(self, "onOfferSDP");
    };

    answer(sdp, onSuccess, onError) {
        this.peer.addAnswerSDP({
                type: "answer",
                sdp: sdp
            },
            onSuccess, onError);
    };

    stopPeer() {
        if (this.peer) {
            console.log("stopping peer");
            this.peer.stop();
        }
    }

    stop() {

        if (this.options.useVideo) {
            this.options.useVideo.style.display = 'none';
            this.options.useVideo['src'] = '';
        }

        if (this.localStream) {
            if(typeof this.localStream.stop === 'function') {
                this.localStream.stop();
            } else {
                if (this.localStream.active){
                    const tracks = this.localStream.getTracks();
                    console.log(tracks);
                    tracks.forEach(function(track, index){
                        console.log(track);
                        track.stop();
                    })
                }
            }
            this.localStream = null;
        }

        if (this.options.localVideo) {
            this.options.localVideo.style.display = 'none';
            this.options.localVideo['src'] = '';
        }

        if (this.options.localVideoStream) {
            if(typeof this.options.localVideoStream.stop === 'function') {
                this.options.localVideoStream.stop();
            } else {
                if (this.options.localVideoStream.active){
                    const tracks = this.options.localVideoStream.getTracks();
                    console.log(tracks);
                    tracks.forEach(function(track, index){
                        console.log(track);
                        track.stop();
                    })
                }
            }
        }

        if (this.peer) {
            console.log("stopping peer");
            this.peer.stop();
        }
    };

    getMute() {
        return this.audioEnabled;
    }

    setMute(what) {
        let audioTracks = this.localStream.getAudioTracks();

        for (let i = 0, len = audioTracks.length; i < len; i++ ) {
            switch(what) {
                case "on":
                    audioTracks[i].enabled = true;
                    break;
                case "off":
                    audioTracks[i].enabled = false;
                    break;
                case "toggle":
                    audioTracks[i].enabled = !audioTracks[i].enabled;
                    break;
                default:
                    break;
            }

            this.audioEnabled = audioTracks[i].enabled;
        }

        return !this.audioEnabled;
    };

    getVideoMute() {
        return this.videoEnabled;
    };

    setVideoMute(what) {
        let videoTracks = this.localStream.getVideoTracks();

        for (let i = 0, len = videoTracks.length; i < len; i++ ) {
            switch(what) {
                case "on":
                    videoTracks[i].enabled = true;
                    break;
                case "off":
                    videoTracks[i].enabled = false;
                    break;
                case "toggle":
                    videoTracks[i].enabled = !videoTracks[i].enabled;
                    break;
                default:
                    break;
            }

            this.videoEnabled = videoTracks[i].enabled;
        }

        return !this.videoEnabled;
    };

    createAnswer(params) {
        this.type = "answer";
        this.remoteSDP = params.sdp;
        console.debug("inbound sdp: ", params.sdp);

        function onSuccess(stream) {
            this.localStream = stream;

            this.peer = RTCPeerConnection({
                type: this.type,
                attachStream: this.localStream,
                onICE: function(candidate) {
                    return this.onICE(this, candidate);
                },
                onICEComplete: function() {
                    return this.onICEComplete(this);
                },
                onRemoteStream: function(stream) {
                    return this.onRemoteStream(this, stream);
                },
                onICESDP: function(sdp) {
                    return this.onICESDP(this, sdp);
                },
                onChannelError: function(e) {
                    return this.onChannelError(this, e);
                },
                constraints: this.options.constraints,
                iceServers: this.options.iceServers,
                offerSDP: {
                    type: "offer",
                    sdp: this.remoteSDP
                }
            });

            this.onStreamSuccess(this);
        }

        function onError(e) {
            this.onStreamError(this, e);
        }

        let mediaParams = getMediaParams(this);

        console.log("Audio constraints", mediaParams.audio);
        console.log("Video constraints", mediaParams.video);

        if (this.options.useVideo && this.options.localVideo) {
            getUserMedia({
                constraints: {
                    audio: false,
                    video: {
                        mandatory: this.options.videoParams,
                        optional: []
                    },
                },
                localVideo: this.options.localVideo,
                onsuccess: function(e) {this.options.localVideoStream = e; console.log("local video ready");},
                onerror: function(e) {console.error("local video error!");}
            });
        }

        getUserMedia({
            constraints: {
                audio: mediaParams.audio,
                video: mediaParams.video
            },
            video: mediaParams.useVideo,
            onsuccess: onSuccess,
            onerror: onError
        });
    };

    getMediaParams(obj) {

        let audio;

        if (obj.options.useMic && obj.options.useMic === "none") {
            console.log("Microphone Disabled");
            audio = false;
        } else if (obj.options.videoParams && obj.options.screenShare) {//obj.options.videoParams.chromeMediaSource == 'desktop') {

            //obj.options.videoParams = {
            //	chromeMediaSource: 'screen',
            //	maxWidth:screen.width,
            //	maxHeight:screen.height
            //	chromeMediaSourceId = sourceId;
            //  };

            console.error("SCREEN SHARE");
            audio = false;
        } else {
            audio = {
                mandatory: {},
                optional: []
            };

            if (obj.options.useMic !== "any") {
                audio.optional = [{sourceId: obj.options.useMic}]
            }

            if (obj.options.audioParams) {
                for (let key in obj.options.audioParams) {
                    let con = {};
                    con[key] = obj.options.audioParams[key];
                    audio.optional.push(con);
                }
            }
        }

        if (obj.options.useVideo && obj.options.localVideo) {
            getUserMedia({
                constraints: {
                    audio: false,
                    video: {
                        mandatory: obj.options.videoParams,
                        optional: []
                    },
                },
                localVideo: obj.options.localVideo,
                onsuccess: function(e) {
                    this.options.localVideoStream = e;
                    console.log("local video ready");
                    },
                onerror: function(e) {
                    console.error("local video error!");
                }
            });
        }

        let video = {};
        const bestFrameRate = obj.options.videoParams.vertoBestFrameRate;
        delete obj.options.videoParams.vertoBestFrameRate;

        video = {
            mandatory: obj.options.videoParams,
            optional: []
        };

        let useVideo = obj.options.useVideo;

        if (useVideo && obj.options.useCamera && obj.options.useCamera !== "none") {
            if (!video.optional) {
                video.optional = [];
            }

            if (obj.options.useCamera !== "any") {
                video.optional.push({sourceId: obj.options.useCamera});
            }

            if (bestFrameRate) {
                video.optional.push({minFrameRate: bestFrameRate});
                video.optional.push({maxFrameRate: bestFrameRate});
            }

        } else {
            console.log("Camera Disabled");
            video = false;
            useVideo = false;
        }

        return {audio: audio, video: video, useVideo: useVideo};
    };

    call(profile) {
        this.checkCompat();

        let screen = false;

        this.type = "offer";

        if (this.options.videoParams && this.options.screenShare) { //self.options.videoParams.chromeMediaSource == 'desktop') {
            screen = true;
        }

         let onSuccess = (stream) => {
            this.localStream = stream;

            if (screen) {
                if (this.moz) {
                    this.options.constraints.OfferToReceiveVideo = false;
                } else {
                    this.options.constraints.mandatory.OfferToReceiveVideo = false;
                }
            }

            this.peer = this.RTCPeerConnection({
                type: this.type,
                attachStream: this.localStream,
                onICE: function(candidate) {
                    return this.onICE(this, candidate);
                },
                onICEComplete: function() {
                    return this.onICEComplete(this);
                },
                onRemoteStream: screen ? function(stream) {} : function(stream) {
                    return this.onRemoteStream(this, stream);
                },
                onOfferSDP: function(sdp) {
                    return this.onOfferSDP(this, sdp);
                },
                onICESDP: function(sdp) {
                    return this.onICESDP(this, sdp);
                },
                onChannelError: function(e) {
                    return this.onChannelError(this, e);
                },
                constraints: this.options.constraints,
                iceServers: this.options.iceServers,
            });

            this.onStreamSuccess(this, stream);
        };

        let onError = (e) => {
            this.onStreamError(this, e);
        };

        let mediaParams = this.getMediaParams(this);

        console.log("Audio constraints", mediaParams.audio);
        console.log("Video constraints", mediaParams.video);

        if (mediaParams.audio || mediaParams.video) {

            getUserMedia({
                constraints: {
                    audio: mediaParams.audio,
                    video: mediaParams.video
                },
                video: mediaParams.useVideo,
                onsuccess: onSuccess,
                onerror: onError
            });
        } else {
            onSuccess(null);
        }

        /*
         navigator.getUserMedia({
         video: self.options.useVideo,
         audio: true
         }, onSuccess, onError);
         */
    };

    // DERIVED from RTCPeerConnection-v1.5
    // 2013, @muazkh - github.com/muaz-khan
    // MIT License - https://www.webrtc-experiment.com/licence/
    // Documentation - https://github.com/muaz-khan/WebRTC-Experiment/tree/master/RTCPeerConnection
    moz = !!navigator.mozGetUserMedia;

    RTCPeerConnection(options) {
        let gathering = false, done = false;

        const w = window,
            PeerConnection = w.mozRTCPeerConnection || w.webkitRTCPeerConnection,
            SessionDescription = w.mozRTCSessionDescription || w.RTCSessionDescription,
            IceCandidate = w.mozRTCIceCandidate || w.RTCIceCandidate;

        const STUN = {
            url: !this.moz ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121'
        };

        let iceServers = null;

        if (options.iceServers) {
            let tmp = options.iceServers;

            if (typeof(tmp) === "boolean") {
                tmp = null;
            }

            if (tmp && !(typeof(tmp) === "object" && tmp.constructor === Array)) {
                console.warn("iceServers must be an array, reverting to default ice servers");
                tmp = null;
            }

            iceServers = {
                iceServers: tmp || [STUN]
            };

            if (!this.moz && !tmp) {
                iceServers.iceServers = [STUN];
            }
        }

        let optional = {
            optional: []
        };

        if (!this.moz) {
            optional.optional = [{
                DtlsSrtpKeyAgreement: true
            },
                {
                    RtpDataChannels: options.onChannelMessage ? true : false
                }];
        }

        let peer = new PeerConnection(iceServers, optional);

        openOffererChannel();
        let x = 0;

        let ice_handler = () => {

            done = true;
            gathering = null;

            if (options.onICEComplete) {
                options.onICEComplete();
            }

            if (options.type === "offer") {
                if ((
                        !this.moz ||
                        (
                            !options.sentICESDP &&
                            peer.localDescription.sdp.match(/a=candidate/)
                        ) && !x && options.onICESDP
                    )) {
                    options.onICESDP(peer.localDescription);
                    //x = 1;
                    /*
                     x = 1;
                     peer.createOffer(function(sessionDescription) {
                     sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                     peer.setLocalDescription(sessionDescription);
                     if (options.onICESDP) {
                     options.onICESDP(sessionDescription);
                     }
                     }, onSdpError, constraints);
                     */
                }
            } else {
                if (!x && options.onICESDP) {
                    options.onICESDP(peer.localDescription);
                    //x = 1;
                    /*
                     x = 1;
                     peer.createAnswer(function(sessionDescription) {
                     sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                     peer.setLocalDescription(sessionDescription);
                     if (options.onICESDP) {
                     options.onICESDP(sessionDescription);
                     }
                     }, onSdpError, constraints);
                     */
                }
            }
        };

        peer.onicecandidate = function(event) {

            if (done) {
                return;
            }

            if (!gathering) {
                gathering = setTimeout(ice_handler, 1000);
            }

            if (event) {
                if (event.candidate) {
                    options.onICE(event.candidate);
                }
            } else {
                done = true;

                if (gathering) {
                    clearTimeout(gathering);
                    gathering = null;
                }

                ice_handler();
            }
        };

        // attachStream = MediaStream;
        if (options.attachStream) peer.addStream(options.attachStream);

        // attachStreams[0] = audio-stream;
        // attachStreams[1] = video-stream;
        // attachStreams[2] = screen-capturing-stream;
        if (options.attachStreams && options.attachStream.length) {
            const streams = options.attachStreams;
            for (let i = 0; i < streams.length; i++) {
                peer.addStream(streams[i]);
            }
        }

        peer.onaddstream = function(event) {
            const remoteMediaStream = event.stream;

            // onRemoteStreamEnded(MediaStream)
            remoteMediaStream.onended = function() {
                if (options.onRemoteStreamEnded) options.onRemoteStreamEnded(remoteMediaStream);
            };

            // onRemoteStream(MediaStream)
            if (options.onRemoteStream) options.onRemoteStream(remoteMediaStream);

            //console.debug('on:add:stream', remoteMediaStream);
        };

        const constraints = options.constraints || {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        };

        // onOfferSDP(RTCSessionDescription)
        function createOffer() {
            if (!options.onOfferSDP) return;

            peer.createOffer( (sessionDescription) => {
                    sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                    peer.setLocalDescription(sessionDescription);
                    options.onOfferSDP(sessionDescription);
                    /* old mozilla behaviour the SDP was already great right away */
                    if (this.moz && options.onICESDP && sessionDescription.sdp.match(/a=candidate/)) {
                        options.onICESDP(sessionDescription);
                        options.sentICESDP = 1;
                    }
                },
                onSdpError, constraints);
        }

        // onAnswerSDP(RTCSessionDescription)
        function createAnswer() {
            if (options.type !== "answer") return;

            //options.offerSDP.sdp = addStereo(options.offerSDP.sdp);
            peer.setRemoteDescription(new SessionDescription(options.offerSDP), onSdpSuccess, onSdpError);
            peer.createAnswer(function(sessionDescription) {
                    sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                    peer.setLocalDescription(sessionDescription);
                    if (options.onAnswerSDP) {
                        options.onAnswerSDP(sessionDescription);
                    }
                },
                onSdpError, constraints);
        }

        // if Mozilla Firefox & DataChannel; offer/answer will be created later
        if ((options.onChannelMessage && !this.moz) || !options.onChannelMessage) {
            createOffer();
            createAnswer();
        }

        // DataChannel Bandwidth
        function setBandwidth(sdp) {
            // remove existing bandwidth lines
            sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
            sdp = sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:1638400\r\n');

            return sdp;
        }

        // old: FF<>Chrome interoperability management
        function getInteropSDP(sdp) {
            let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
                extractedChars = '';

            function getChars() {
                extractedChars += chars[parseInt(Math.random() * 40)] || '';
                if (extractedChars.length < 40) getChars();

                return extractedChars;
            }

            // usually audio-only streaming failure occurs out of audio-specific crypto line
            // a=crypto:1 AES_CM_128_HMAC_SHA1_32 --------- kAttributeCryptoVoice
            if (options.onAnswerSDP) sdp = sdp.replace(/(a=crypto:0 AES_CM_128_HMAC_SHA1_32)(.*?)(\r\n)/g, '');

            // video-specific crypto line i.e. SHA1_80
            // a=crypto:1 AES_CM_128_HMAC_SHA1_80 --------- kAttributeCryptoVideo
            const inline = getChars() + '\r\n' + (extractedChars = '');
            sdp = sdp.indexOf('a=crypto') === -1 ? sdp.replace(/c=IN/g, 'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:' + inline + 'c=IN') : sdp;

            return sdp;
        }

        function serializeSdp(sdp) {
            //if (!moz) sdp = setBandwidth(sdp);
            //sdp = getInteropSDP(sdp);
            //console.debug(sdp);
            return sdp;
        }

        // DataChannel management
        let channel;

        let openOffererChannel = () => {
            if (!options.onChannelMessage || (this.moz && !options.onOfferSDP)) return;

            _openOffererChannel();

            if (!this.moz) return;
            navigator.mozGetUserMedia({
                    audio: true,
                    fake: true
                },
                function(stream) {
                    peer.addStream(stream);
                    createOffer();
                },
                useless);
        };

        let _openOffererChannel = () => {
            channel = peer.createDataChannel(options.channel || 'RTCDataChannel', this.moz ? {} : {
                reliable: false
            });

            if (this.moz) channel.binaryType = 'blob';

            setChannelEvents();
        };

        function setChannelEvents() {
            channel.onmessage = function(event) {
                if (options.onChannelMessage) options.onChannelMessage(event);
            };

            channel.onopen = function() {
                if (options.onChannelOpened) options.onChannelOpened(channel);
            };
            channel.onclose = function(event) {
                if (options.onChannelClosed) options.onChannelClosed(event);

                console.warn('WebRTC DataChannel closed', event);
            };
            channel.onerror = function(event) {
                if (options.onChannelError) options.onChannelError(event);

                console.error('WebRTC DataChannel error', event);
            };
        }

        if (options.onAnswerSDP && this.moz && options.onChannelMessage) openAnswererChannel();

        let openAnswererChannel = () => {
            peer.ondatachannel = function(event) {
                channel = event.channel;
                channel.binaryType = 'blob';
                setChannelEvents();
            };

            if (!this.moz) return;
            navigator.mozGetUserMedia({
                    audio: true,
                    fake: true
                },
                function(stream) {
                    peer.addStream(stream);
                    createAnswer();
                },
                useless);
        };

        // fake:true is also available on chrome under a flag!
        function useless() {
            console.log('Error in fake:true');
        }

        function onSdpSuccess() {}

        function onSdpError(e) {
            if (options.onChannelError) {
                options.onChannelError(e);
            }
            console.error('sdp error:', e);
        }

        return {
            addAnswerSDP: function(sdp, cbSuccess, cbError) {

                peer.setRemoteDescription(
                    new SessionDescription(sdp),
                    cbSuccess ? cbSuccess : onSdpSuccess,
                    cbError ? cbError : onSdpError
                );
            },
            addICE: function(candidate) {
                peer.addIceCandidate(new IceCandidate({
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    candidate: candidate.candidate
                }));
            },

            peer: peer,
            channel: channel,
            sendData: function(message) {
                if (channel) {
                    channel.send(message);
                }
            },

            stop: function() {
                peer.close();
                if (options.attachStream) {
                    if(typeof options.attachStream.stop === 'function') {
                        options.attachStream.stop();
                    } else {
                        options.attachStream.active = false;
                    }
                }
            }

        };
    };

    resSupported(w, h) {
        for (let i in this.validRes) {
            if (this.validRes[i][0] === w && this.validRes[i][1] === h) {
                return true;
            }
        }

        return false;
    };

    bestResSupported() {
        let w = 0, h = 0;

        for (let i in this.validRes) {
            if (this.validRes[i][0] > w && this.validRes[i][1] > h) {
                w = this.validRes[i][0];
                h = this.validRes[i][1];
            }
        }

        return [w, h];
    };

    resList = [[320, 180], [320, 240], [640, 360], [640, 480], [1280, 720], [1920, 1080]];
    resI = 0;
    ttl = 0;

    checkRes(cam, func) {

        if (this.resI >= this.resList.length) {
            const res = {
                'validRes': this.validRes,
                'bestResSupported': this.bestResSupported()
            };

            localStorage.setItem("res_" + cam, JSON.stringify(res));

            if (func) return func(res);
            return;
        }

        let video = {
            mandatory: {},
            optional: []
        };

        if (cam) {
            video.optional = [{sourceId: cam}];
        }

        const w = this.resList[this.resI][0];
        const h = this.resList[this.resI][1];
        this.resI++;

        video.mandatory = {
            "minWidth": w,
            "minHeight": h,
            "maxWidth": w,
            "maxHeight": h
        };

        getUserMedia({
            constraints: {
                audio: this.ttl++ === 0,
                video: video
            },
            onsuccess: (e) => {
                e.getTracks().forEach(function(track) {
                    track.stop();
                });
                console.info(w + "x" + h + " supported.");
                this.validRes.push([w, h]);
                this.checkRes(cam, func);},
            onerror: (e) => {
                console.error( w + "x" + h + " not supported.");
                this.checkRes(cam, func);
            }
        });
    };

    getValidRes(cam, func) {
        let used = [];
        const cached = localStorage.getItem("res_" + cam);

        if (cached) {
            const cache = JSON.parse(cached);

            if (cache) {
                this.validRes = cache.validRes;
                console.log("CACHED RES FOR CAM " + cam, cache);
            } else {
                console.error("INVALID CACHE");
            }
            return func ? func(cache) : null;
        }

        this.validRes = [];
        this.resI = 0;

        this.checkRes(cam, func);
    };

    checkPerms(runtime, check_audio, check_video) {
        getUserMedia({
            constraints: {
                audio: check_audio,
                video: check_video,
            },
            onsuccess: (e) => {
                e.getTracks().forEach(function(track) {
                    track.stop();
                });

                console.info("media perm init complete");

                if (runtime) {
                    setTimeout(runtime, 100, true);
                }
            },
            onerror: (e) => {
                if (check_video && check_audio) {
                    console.error("error, retesting with audio params only");
                    return this.checkPerms(runtime, check_audio, false);
                }

                console.error("media perm init error");

                if (runtime) {
                    runtime(false)
                }
            }
        });
    };
}

export default FSRTC;
