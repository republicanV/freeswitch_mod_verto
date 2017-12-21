import Verto from './verto';
import generateGUID from './generateGuid';
import FSRTC from './FSRTC';


/**
 * Dialog class
 */
class Dialog extends Verto {
    constructor(direction, verto, params) {
        super();

        this.params = {...this.params, ...params};

        this.tag = this.options.tag;
        if (typeof(this.tag) === "function") {
            this.tag = this.tag();
        }

        this.verto = new Verto();
        this.direction = direction;
        this.lastState = null;
        this.state = this.lastState = this.verto.enum.state.new;
        this.callbacks = this.verto.callbacks;
        this.answered = false;
        this.attach = params.attach || false;
        this.screenShare = params.screenShare || false;
        this.useCamera = this.params.useCamera;
        this.useMic = this.params.useMic;
        this.useSpeak = this.params.useSpeak;

        if (this.params.callID) {
            this.callID = this.params.callID;
        } else {
            this.callID = this.params.callID = generateGUID();
        }

        if (this.params.tag) {
            this.audioStream = document.getElementById(this.params.tag);

            if (this.params.useVideo) {
                this.videoStream = this.audioStream;
            }
        } //else conjure one TBD

        if (this.params.localTag) {
            this.localVideo = document.getElementById(this.params.localTag);
        }

        this.verto.dialogs[this.callID] = this;

        let RTCcallbacks = {};

        if (this.direction === this.verto.enum.direction.inbound) {
            if (this.params.display_direction === "outbound") {
                this.params.remote_caller_id_name = this.params.caller_id_name;
                this.params.remote_caller_id_number = this.params.caller_id_number;
            } else {
                this.params.remote_caller_id_name = this.params.callee_id_name;
                this.params.remote_caller_id_number = this.params.callee_id_number;
            }

            if (!this.params.remote_caller_id_name) {
                this.params.remote_caller_id_name = "Nobody";
            }

            if (!this.params.remote_caller_id_number) {
                this.params.remote_caller_id_number = "UNKNOWN";
            }

            RTCcallbacks.onMessage = function(rtc, msg) {
                console.debug(msg);
            };

            RTCcallbacks.onAnswerSDP = function(rtc, sdp) {
                console.error("answer sdp", sdp);
            };
        } else {
            this.params.remote_caller_id_name = "Outbound Call";
            this.params.remote_caller_id_number = this.params.destination_number;
        }

        RTCcallbacks.onICESDP = (rtc) => {
            console.log("RECV " + rtc.type + " SDP", rtc.mediaData.SDP);

            if (
                this.state === this.verto.enum.state.requesting ||
                this.state === this.verto.enum.state.answering ||
                this.state === this.verto.enum.state.active
            )
                {
                    location.reload();
                    return;
                }

            if (rtc.type === "offer") {
                if (this.state === this.verto.enum.state.active) {
                    this.setState(this.verto.enum.state.requesting);
                    this.sendMethod("verto.attach", {
                        sdp: rtc.mediaData.SDP
                    });
                } else {
                    this.setState(this.verto.enum.state.requesting);

                    this.sendMethod("verto.invite", {
                        sdp: rtc.mediaData.SDP
                    });
                }
            } else { //answer
                this.setState(this.verto.enum.state.answering);

                this.sendMethod(this.attach ? "verto.attach" : "verto.answer", {
                    sdp: dialog.rtc.mediaData.SDP
                });
            }
        };

        RTCcallbacks.onICE = function(rtc) {
            //console.log("cand", rtc.mediaData.candidate);
            if (rtc.type === "offer") {
                console.log("offer", rtc.mediaData.candidate);
                return;
            }
        };

        RTCcallbacks.onStream = function(rtc, stream) {
            console.log("stream started");
        };

        RTCcallbacks.onError = function(e) {
            console.error("ERROR:", e);
            this.hangup({cause: "Device or Permission Error"});
        };

        this.rtc = new FSRTC({
            callbacks: RTCcallbacks,
            localVideo: this.screenShare ? null : this.localVideo,
            useVideo: this.params.useVideo ? this.videoStream : null,
            useAudio: this.audioStream,
            useStereo: this.params.useStereo,
            videoParams: this.params.videoParams,
            audioParams: this.verto.options.audioParams,
            iceServers: this.verto.options.iceServers,
            screenShare: this.screenShare,
            useCamera: this.useCamera,
            useMic: this.useMic,
            useSpeak: this.useSpeak
        });

        this.rtc.verto = this.verto;

        if (this.direction === this.verto.enum.direction.inbound) {
            if (this.attach) {
                this.answer();
            } else {
                this.ring();
            }
        }

    }

    /**
     *
     * @type {
     *         {
     *            useVideo: *,
     *            useStereo: *,
     *            screenShare: boolean,
     *            useCamera: *|string|string,
     *            useMic: *|string,
     *            useSpeak: *|string,
     *            tag: *,
     *            localTag: null,
     *            login: null,
     *            videoParams: {}|Verto.options.videoParams
     *          }
     *        }
     */
    params = {
        useVideo: this.options.useVideo,
        useStereo: this.options.useStereo,
        screenShare: false,
        useCamera: this.options.deviceParams.useCamera,
        useMic: this.options.deviceParams.useMic,
        useSpeak: this.options.deviceParams.useSpeak,
        tag: this.tag,
        localTag: this.options.localTag,
        login: this.options.login,
        videoParams: this.options.videoParams
    };

    invite() {
        this.rtc.call();
    };

    sendMethod(method, obj) {
        obj.dialogParams = {};

        for (let i in this.params) {
            if (i === "sdp" && method !== "verto.invite" && method !== "verto.attach") {
                continue;
            }

            obj.dialogParams[i] = this.params[i];
        }

        this.verto.rpcClient.call(method, obj,

            function(e) {
                /* Success */
                //dialog.processReply(method, true, e);
                this.processReply(method, true, e);
            },

            function(e) {
                /* Error */
                //dialog.processReply(method, false, e);
                this.processReply(method, false, e);
            });
    };

    // ????? Maybe move this function to Verto class ?????
    checkStateChange = (oldS, newS) => {

        if (newS === this.verto.enum.state.purge || this.verto.enum.states[oldS.name][newS.name]) {
            return true;
        }

        return false;
    };

    // Attach audio output device to video element using device/sink ID.
    // ????? Maybe move this function to Verto class ?????
    find_name = (id) => {
        for (let i in this.verto.audioOutDevices) {
            let source = this.verto.audioOutDevices[i];
            if (source.id === id) {
                return(source.label);
            }
        }

        return id;
    };

    setAudioPlaybackDevice(sinkId, callback, arg) {
        let element = this.audioStream;

        if (typeof element.sinkId !== 'undefined') {
            let devname = this.find_name(sinkId);
            console.info("Dialog: " + this.callID + " Setting speaker:", element, devname);

            element.setSinkId(sinkId)
                .then( () => {
                    console.log("Dialog: " + this.callID + ' Success, audio output device attached: ' + sinkId);
                    if (callback) {
                        callback(true, devname, arg);
                    }
                })
                .catch( (error) => {
                    let errorMessage = error;
                    if (error.name === 'SecurityError') {
                        errorMessage = "Dialog: " + this.callID + ' You need to use HTTPS for selecting audio output ' +
                            'device: ' + error;
                    }
                    if (callback) {
                        callback(false, null, arg);
                    }
                    console.error(errorMessage);
                });
        } else {
            console.warn("Dialog: " + this.callID + ' Browser does not support output device selection.');
            if (callback) {
                callback(false, null, arg);
            }
        }
    };

    setState(state) {

        if (this.state === this.verto.enum.state.ringing) {
            this.stopRinging();
        }

        if (this.state === state || !this.checkStateChange(this.state, state)) {
            console.error("Dialog " + this.callID + ": INVALID state change from " + this.state.name + " to " + state.name);
            this.hangup();
            return false;
        }

        console.log("Dialog " + this.callID + ": state change from " + this.state.name + " to " + state.name);

        this.lastState = this.state;
        this.state = state;

        if (!this.causeCode) {
            this.causeCode = 16;
        }

        if (!this.cause) {
            this.cause = "NORMAL CLEARING";
        }

        if (this.callbacks.onDialogState) {
            this.callbacks.onDialogState(this);
        }

        switch (this.state) {

            case this.verto.enum.state.early:
            case this.verto.enum.state.active:

                let speaker = this.useSpeak;
                console.info("Using Speaker: ", speaker);

                if (speaker && speaker !== "any" && speaker !== "none") {
                    setTimeout( () => {
                        this.setAudioPlaybackDevice(speaker);
                    }, 500);
                }

                break;

            case this.verto.enum.state.trying:
                setTimeout( () => {
                    if (this.state === this.verto.enum.state.trying) {
                        this.setState(this.verto.enum.state.hangup);
                    }
                }, 30000);
                break;
            case this.verto.enum.state.purge:
                this.setState(this.verto.enum.state.destroy);
                break;
            case this.verto.enum.state.hangup:

                if (this.lastState.val > this.verto.enum.state.requesting.val && this.lastState.val < this.verto.enum.state.hangup.val) {
                    this.sendMethod("verto.bye", {});
                }

                this.setState(this.verto.enum.state.destroy);
                break;
            case this.verto.enum.state.destroy:

                if (typeof(this.verto.options.tag) === "function") {
                    // !!!!! ======> TODO
                    $('#' + this.params.tag).remove(); // TODO: rewrite this remove method with ES6
                }

                delete this.verto.dialogs[this.callID];
                if (this.params.screenShare) {
                    this.rtc.stopPeer();
                } else {
                    this.rtc.stop();
                }
                break;
        }

        return true;
    };

    processReply(method, success, e) {
        //console.log("Response: " + method + " State:" + dialog.state.name, success, e);

        switch (method) {

            case "verto.answer":
            case "verto.attach":
                if (success) {
                    this.setState(this.verto.enum.state.active);
                } else {
                    this.hangup();
                }
                break;
            case "verto.invite":
                if (success) {
                    this.setState(this.verto.enum.state.trying);
                } else {
                    dialog.setState(this.verto.enum.state.destroy);
                }
                break;

            case "verto.bye":
                this.hangup();
                break;

            case "verto.modify":
                if (e.holdState) {
                    if (e.holdState === "held") {
                        if (this.state !== this.verto.enum.state.held) {
                            this.setState(this.verto.enum.state.held);
                        }
                    } else if (e.holdState === "active") {
                        if (this.state !== this.verto.enum.state.active) {
                            this.setState(this.verto.enum.state.active);
                        }
                    }
                }

                if (success) {}

                break;

            default:
                break;
        }

    };

    /**
     *
     * @param params
     */
    hangup(params) {

        if (params) {
            if (params.causeCode) {
                this.causeCode = params.causeCode;
            }

            if (params.cause) {
                this.cause = params.cause;
            }
        }

        if (this.state.val >= this.verto.enum.state.new.val && this.state.val < this.verto.enum.state.hangup.val) {
            this.setState(this.verto.enum.state.hangup);
        } else if (this.state.val < this.verto.enum.state.destroy) {
            this.setState(this.verto.enum.state.destroy);
        }
    };

    /**
     *
     */
    stopRinging() {
        if (this.verto.ringer) {
            this.verto.ringer.stop();
        }
    };

    /**
     *
     */
    indicateRing() {

        if (this.verto.ringer) {
            // !!! TODO ====================>
            this.verto.ringer.attr("src", this.verto.options.ringFile)[0].play(); // TODO: overwrite this with ES6

            setTimeout( () => {
                    this.stopRinging();
                    if (this.state === this.verto.enum.state.ringing) {
                        this.indicateRing();
                    }
                },
                this.verto.options.ringSleep
            );
        }
    };

    ring() {
        this.setState(this.verto.enum.state.ringing);
        this.indicateRing();
    };

    /**
     *
     * @param on
     */
    useVideo(on) {

        this.params.useVideo = on;

        if (on) {
            this.videoStream = this.audioStream;
        } else {
            this.videoStream = null;
        }

        this.rtc.useVideo(this.videoStream, this.localVideo);
    };

    /**
     *
     * @param what
     * @returns {*}
     */
    setMute(what) {
        return this.rtc.setMute(what);
    };

    getMute() {
        return this.rtc.getMute();
    };

    /**
     *
     * @param what
     * @returns {*}
     */
    setVideoMute(what) {
        return this.rtc.setVideoMute(what);
    };

    getVideoMute() {
        return this.rtc.getVideoMute();
    };

    /**
     *
     * @param on
     */
    useStereo(on) {
        this.params.useStereo = on;
        this.rtc.useStereo(on);
    };

    /**
     *
     * @param digits
     */
    dtmf(digits) {
        if (digits) {
            this.sendMethod("verto.info", {
                dtmf: digits
            });
        }
    };

    transfer(dest, params) {
        if (dest) {
            this.sendMethod("verto.modify", {
                action: "transfer",
                destination: dest,
                params: params
            });
        }
    };

    /**
     *
     * @param params
     */
    hold(params) {

        this.sendMethod("verto.modify", {
            action: "hold",
            params: params
        });
    };

    /**
     *
     * @param params
     */
    unhold(params) {
        this.sendMethod("verto.modify", {
            action: "unhold",
            params: params
        });
    };

    /**
     *
     * @param params
     */
    toggleHold(params) {
        this.sendMethod("verto.modify", {
            action: "toggleHold",
            params: params
        });
    };

    /**
     *
     * @param msg
     * @returns {boolean}
     */
    message(msg) {
        let err = 0;
        msg.from = this.params.login;

        if (!msg.to) {
            console.error("Missing To");
            err++;
        }

        if (!msg.body) {
            console.error("Missing Body");
            err++;
        }

        if (err) {
            return false;
        }

        this.sendMethod("verto.info", {
            msg: msg
        });

        return true;
    };

    /**
     *
     * @param params
     */
    answer(params) {
        if (!this.answered) {
            if (!params) {
                params = {};
            }

            params.sdp = this.params.sdp;

            if (params) {
                if (params.useVideo) {
                    this.useVideo(true);
                }
                this.params.callee_id_name = params.callee_id_name;
                this.params.callee_id_number = params.callee_id_number;

                if (params.useCamera) {
                    this.useCamera = params.useCamera;
                }

                if (params.useMic) {
                    this.useMic = params.useMic;
                }

                if (params.useSpeak) {
                    this.useSpeak = params.useSpeak;
                }
            }

            this.rtc.createAnswer(params);
            this.answered = true;
        }
    };

    /**
     *
     * @param params
     */
    handleAnswer(params) {
        this.gotAnswer = true;

        if (this.state.val >= this.verto.enum.state.active.val) {
            return;
        }

        if (this.state.val >= this.verto.enum.state.early.val) {
            this.setState(this.verto.enum.state.active);
        } else {
            if (this.gotEarly) {
                console.log("Dialog " + this.callID + " Got answer while still establishing early media, delaying...");
            } else {
                console.log("Dialog " + this.callID + " Answering Channel");
                this.rtc.answer(params.sdp, function() {
                    this.setState(this.verto.enum.state.active);
                }, function(e) {
                    console.error(e);
                    this.hangup();
                });
                console.log("Dialog " + this.callID + "ANSWER SDP", params.sdp);
            }
        }
    };

    cidString(enc) {
        let party = this.params.remote_caller_id_name +
            (enc ? " &lt;" : " <") +
            this.params.remote_caller_id_number + (enc ? "&gt;" : ">");
        return party;
    };

    sendMessage(msg, params) {
        if (this.callbacks.onMessage) {
            this.callbacks.onMessage(this.verto, this, msg, params);
        }
    };

    handleInfo(params) {
        this.sendMessage(this.verto.enum.message.info, params.msg);
    };

    /**
     *
     * @param params
     */
    handleDisplay(params) {
        if (params.display_name) {
            this.params.remote_caller_id_name = params.display_name;
        }
        if (params.display_number) {
            this.params.remote_caller_id_number = params.display_number;
        }

        this.sendMessage(this.verto.enum.message.display, {});
    };

    handleMedia(params) {
        if (this.state.val >= this.verto.enum.state.early.val) {
            return;
        }

        this.gotEarly = true;

        this.rtc.answer(params.sdp, () => {
            console.log("Dialog " + this.callID + "Establishing early media");
            this.setState(this.verto.enum.state.early);

            if (this.gotAnswer) {
                console.log("Dialog " + this.callID + "Answering Channel");
                this.setState(this.verto.enum.state.active);
            }
        }, function(e) {
            console.error(e);
            this.hangup();
        });
        console.log("Dialog " + this.callID + "EARLY SDP", params.sdp);
    };
}

export default Dialog;