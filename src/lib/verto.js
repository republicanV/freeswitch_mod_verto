import generateGUID from './generateGuid';
import FSRTC from './FSRTC';
import JsonRpcClient from './jsonrpcclient';
import Dialog from './Dialog';

/**
 * Verto class
 */
class Verto {

    /**
     *
     * @param options
     * @param callbacks
     */
    constructor(options={}, callbacks) {

        this.options = {...this.options, ...options};
        this.callbacks = callbacks || {};

        this.FSRTC = new FSRTC;
        this.Dialog = new Dialog();

        if (this.options.deviceParams.useCamera) {
            this.FSRTC.getValidRes(this.options.deviceParams.useCamera, this.options.deviceParams.onResCheck);
        }

        if (this.options.deviceParams.useCamera) {
            this.FSRTC.getValidRes(this.options.deviceParams.useCamera, this.options.deviceParams.onResCheck);
        }

        if (!this.options.deviceParams.useMic) {
            this.options.deviceParams.useMic = "any";
        }

        if (!this.options.deviceParams.useSpeak) {
            this.options.deviceParams.useSpeak = "any";
        }

        if (this.options.sessid) {
            this.sessid = this.options.sessid;
        } else {
            this.sessid = localStorage.getItem("verto_session_uuid") || generateGUID();
            localStorage.setItem("verto_session_uuid", this.sessid);
        }

        this.dialogs = {};
        this.eventSUBS = {};

        /**
         *
         * @type {JsonRpcClient}
         */
        this.rpcClient = new JsonRpcClient({
            login: this.options.login,
            passwd: this.options.passwd,
            socketUrl: this.options.socketUrl,
            loginParams: this.options.loginParams,
            userVariables: this.options.userVariables,
            sessid: this.sessid,
            onmessage: (e) => {
                return this.handleMessage(e.eventData);
            },
            onWSConnect: function(o) {
                o.call('login', {});
            },
            onWSLogin: (success) => {
                if (this.callbacks.onWSLogin) {
                    this.callbacks.onWSLogin(this, success);
                }
            },
            onWSClose: (success) => {
                if (this.callbacks.onWSClose) {
                    this.callbacks.onWSClose(this, success);
                }
                this.purge();
            }
        });

        let tag = this.options.tag;
        if (typeof(tag) === "function") {
            tag = tag();
        }

        if (this.options.ringFile && this.options.tag) {
            this.ringer = $("#" + tag); // !!!! rewrite this selector !!!!
        }

        this.rpcClient.call('login', {});

        // Enum object
        this.enum = {};
        this.enum.states = Object.freeze({
            new: {
                requesting: 1,
                recovering: 1,
                ringing: 1,
                destroy: 1,
                answering: 1,
                hangup: 1
            },
            requesting: {
                trying: 1,
                hangup: 1,
                active: 1
            },
            recovering: {
                answering: 1,
                hangup: 1
            },
            trying: {
                active: 1,
                early: 1,
                hangup: 1
            },
            ringing: {
                answering: 1,
                hangup: 1
            },
            answering: {
                active: 1,
                hangup: 1
            },
            active: {
                answering: 1,
                requesting: 1,
                hangup: 1,
                held: 1
            },
            held: {
                hangup: 1,
                active: 1
            },
            early: {
                hangup: 1,
                active: 1
            },
            hangup: {
                destroy: 1
            },
            destroy: {},
            purge: {
                destroy: 1
            }
        });
        this.enum.state = this.ENUM("new requesting trying recovering ringing answering early active held hangup destroy purge");
        this.enum.direction = this.ENUM("inbound outbound");
        this.enum.message = this.ENUM("display info pvtEvent");
        this.enum = Object.freeze(this.enum);
    }

    /**
     *
     * @type {
     *          {
     *              login: null,
     *              passwd: null,
     *              socketUrl: null,
     *              tag: null,
     *              localTag: null,
     *              videoParams: {},
     *              audioParams: {},
     *              loginParams: {},
     *              deviceParams: {onResCheck: null},
     *              userVariables: {},
     *              iceServers: boolean,
     *              ringSleep: number,
     *              sessid: null
     *          }
     *        }
     */
    options = {
        login: null,
        passwd: null,
        socketUrl: null,
        tag: null,
        localTag: null,
        videoParams: {},
        audioParams: {},
        loginParams: {},
        deviceParams: {onResCheck: null},
        userVariables: {},
        iceServers: false,
        ringSleep: 6000,
        sessid: null
    };

    /**
     *
     * @param obj
     */
    deviceParams(obj) {
        for (let i in obj) {
            this.options.deviceParams[i] = obj[i];
        }

        if (obj.useCamera) {
            this.FSRTC.getValidRes(this.options.deviceParams.useCamera, obj ? obj.onResCheck : undefined);
        }
    };

    /**
     *
     * @param obj
     */
    videoParams(obj) {
        for (let i in obj) {
            this.options.videoParams[i] = obj[i];
        }
    };

    /**
     *
     * @param obj
     */
    iceServers(obj) {
        this.options.iceServers = obj;
    };

    /**
     *
     * @param params
     */
    loginData(params) {
        this.options.login = params.login;
        this.options.passwd = params.passwd;
        this.rpcClient.loginData(params);
    };

    /**
     *
     * @param msg
     */
    logout(msg) {
        this.rpcClient.closeSocket();
        if (this.callbacks.onWSClose) {
            this.callbacks.onWSClose(this, false);
        }
        this.purge();
    };

    /**
     *
     * @param msg
     */
    login(msg) {
        this.logout();
        this.rpcClient.call('login', {});
    };

    /**
     *
     * @param msg
     * @returns {boolean}
     */
    message(msg) {
        let err = 0;

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
     * @param method
     * @param success
     * @param e
     */
    processReply(method, success, e) {
        let i;

        //console.log("Response: " + method, success, e);

        switch (method) {
            case "verto.subscribe":
                for (i in e.unauthorizedChannels) {
                    this.drop_bad(e.unauthorizedChannels[i]);
                }
                for (i in e.subscribedChannels) {
                    this.mark_ready(e.subscribedChannels[i]);
                }

                break;
            case "verto.unsubscribe":
                //console.error(e);
                break;
        }
    };

    /**
     *
     * @param method
     * @param params
     */
    sendMethod(method, params) {
        //var verto = this;
        this.rpcClient.call(method, params,

            (e) => {
                /* Success */
                this.processReply(method, true, e);
            },

            (e) => {
                /* Error */
                this.processReply(method, false, e);
            });
    };

    /**
     *
     * @param channel
     */
    drop_bad( channel) {
        console.error("drop unauthorized channel: " + channel);
        delete this.eventSUBS[channel];
    };

    /**
     *
     * @param channel
     */
    mark_ready(channel) {
        for (let j in this.eventSUBS[channel]) {
            this.eventSUBS[channel][j].ready = true;
            console.log("subscribed to channel: " + channel);
            if (this.eventSUBS[channel][j].readyHandler) {
                this.eventSUBS[channel][j].readyHandler(this, channel);
            }
        }
    };

    /**
     *
     * @type {number}
     */
    SERNO = 1;

    /**
     *
     * @param verto
     * @param channel
     * @param subChannels
     * @param sparams
     * @returns {{serno: number|*, eventChannel: *}}
     */
    do_subscribe(channel, subChannels, sparams) {
        let params = sparams || {};

        let local = params.local;

        let obj = {
            eventChannel: channel,
            userData: params.userData,
            handler: params.handler,
            ready: false,
            readyHandler: params.readyHandler,
            serno: this.SERNO++
        };

        let isnew = false;

        if (!this.eventSUBS[channel]) {
            this.eventSUBS[channel] = [];
            subChannels.push(channel);
            isnew = true;
        }

        this.eventSUBS[channel].push(obj);

        if (local) {
            obj.ready = true;
            obj.local = true;
        }

        if (!isnew && this.eventSUBS[channel][0].ready) {
            obj.ready = true;
            if (obj.readyHandler) {
                obj.readyHandler(this, channel);
            }
        }

        return {
            serno: obj.serno,
            eventChannel: channel
        };
    };

    /**
     *
     * @param channel
     * @param sparams
     * @returns {Array}
     */
    subscribe(channel, sparams) {
        //var verto = this;
        let r = [];
        let subChannels = [];
        let params = sparams || {};

        if (typeof(channel) === "string") {
            r.push(this.do_subscribe(channel, subChannels, params));
        } else {
            for (let i in channel) {
                r.push(this.do_subscribe(channel, subChannels, params));
            }
        }

        if (subChannels.length) {
            this.sendMethod("verto.subscribe", {
                eventChannel: subChannels.length === 1 ? subChannels[0] : subChannels,
                subParams: params.subParams
            });
        }

        return r;
    };

    /**
     *
     * @param handle
     */
    unsubscribe(handle) {
        //var verto = this;
        let i;

        if (!handle) {
            for (i in this.eventSUBS) {
                if (this.eventSUBS[i]) {
                    this.unsubscribe(this.eventSUBS[i]);
                }
            }
        } else {
            let unsubChannels = {};
            let sendChannels = [];
            let channel;

            if (typeof(handle) === "string") {
                delete this.eventSUBS[handle];
                unsubChannels[handle]++;
            } else {
                for (i in handle) {
                    if (typeof(handle[i]) === "string") {
                        channel = handle[i];
                        delete this.eventSUBS[channel];
                        unsubChannels[channel]++;
                    } else {
                        let repl = [];
                        channel = handle[i].eventChannel;

                        for (let j in this.eventSUBS[channel]) {
                            if (this.eventSUBS[channel][j].serno === handle[i].serno) {} else {
                                repl.push(this.eventSUBS[channel][j]);
                            }
                        }

                        this.eventSUBS[channel] = repl;

                        if (this.eventSUBS[channel].length === 0) {
                            delete this.eventSUBS[channel];
                            unsubChannels[channel]++;
                        }
                    }
                }
            }

            for (let u in unsubChannels) {
                console.log("Sending Unsubscribe for: ", u);
                sendChannels.push(u);
            }

            if (sendChannels.length) {
                this.sendMethod("verto.unsubscribe", {
                    eventChannel: sendChannels.length === 1 ? sendChannels[0] : sendChannels
                });
            }
        }
    };

    /**
     *
     * @param channel
     * @param params
     */
    broadcast(channel, params) {
        // var verto = this;
        let msg = {
            eventChannel: channel,
            data: {}
        };
        for (let i in params) {
            msg.data[i] = params[i];
        }
        this.sendMethod("verto.broadcast", msg);
    };

    /**
     *
     * @param callID
     */
    purge(callID) {
        // var verto = this;
        let x = 0;
        let i;

        for (i in this.dialogs) {
            if (!x) {
                console.log("purging dialogs");
            }
            x++;
            //verto.dialogs[i].setState($.verto.enum.state.purge);
            this.dialogs[i].setState(this.enum.state.purge);
        }

        for (i in this.eventSUBS) {
            if (this.eventSUBS[i]) {
                console.log("purging subscription: " + i);
                delete this.eventSUBS[i];
            }
        }
    };

    /**
     *
     * @param callID
     */
    hangup(callID) {
        // var verto = this;
        if (callID) {
            const dialog = this.dialogs[callID];

            if (dialog) {
                dialog.hangup();
            }
        } else {
            for (let i in this.dialogs) {
                this.dialogs[i].hangup();
            }
        }
    };

    /**
     *
     * @param args
     * @param callbacks
     * @returns {verto.dialog}
     */
    newCall(args, callbacks) {
        // const verto = this;

        if (!this.rpcClient.socketReady()) {
            console.error("Not Connected...");
            return;
        }

        let dialog = new this.Dialog(this.enum.direction.outbound, this, args);

        dialog.invite();

        if (callbacks) {
            dialog.callbacks = callbacks;
        }

        return dialog;
    };

    handleMessage(data) {
        // var verto = this;

        if (!(data && data.method)) {
            console.error("Invalid Data", data);
            return;
        }

        if (data.params.callID) {
            let dialog = this.dialogs[data.params.callID];

            if (data.method === "verto.attach" && dialog) {
                delete dialog.this.dialogs[dialog.callID];
                dialog.rtc.stop();
                dialog = null;
            }

            if (dialog) {

                switch (data.method) {
                    case 'verto.bye':
                        dialog.hangup(data.params);
                        break;
                    case 'verto.answer':
                        dialog.handleAnswer(data.params);
                        break;
                    case 'verto.media':
                        dialog.handleMedia(data.params);
                        break;
                    case 'verto.display':
                        dialog.handleDisplay(data.params);
                        break;
                    case 'verto.info':
                        dialog.handleInfo(data.params);
                        break;
                    default:
                        console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", dialog, data.method);
                        break;
                }
            } else {

                switch (data.method) {
                    case 'verto.attach':
                        data.params.attach = true;

                        if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
                            data.params.useVideo = true;
                        }

                        if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
                            data.params.useStereo = true;
                        }

                        dialog = new $.verto.dialog($.verto.enum.direction.inbound, verto, data.params);
                        dialog.setState($.verto.enum.state.recovering);

                        break;
                    case 'verto.invite':

                        if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
                            data.params.wantVideo = true;
                        }

                        if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
                            data.params.useStereo = true;
                        }

                        dialog = new this.Dialog(this.enum.direction.inbound, verto, data.params);
                        break;
                    default:
                        console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED");
                        break;
                }
            }

            return {
                method: data.method
            };
        } else {
            switch (data.method) {
                case 'verto.punt':
                    verto.purge();
                    verto.logout();
                    break;
                case 'verto.event':
                    var list = null;
                    var key = null;

                    if (data.params) {
                        key = data.params.eventChannel;
                    }

                    if (key) {
                        list = verto.eventSUBS[key];

                        if (!list) {
                            list = verto.eventSUBS[key.split(".")[0]];
                        }
                    }

                    if (!list && key && key === verto.sessid) {
                        if (verto.callbacks.onMessage) {
                            verto.callbacks.onMessage(verto, null, $.verto.enum.message.pvtEvent, data.params);
                        }
                    } else if (!list && key && verto.dialogs[key]) {
                        verto.dialogs[key].sendMessage($.verto.enum.message.pvtEvent, data.params);
                    } else if (!list) {
                        if (!key) {
                            key = "UNDEFINED";
                        }
                        console.error("UNSUBBED or invalid EVENT " + key + " IGNORED");
                    } else {
                        for (var i in list) {
                            var sub = list[i];

                            if (!sub || !sub.ready) {
                                console.error("invalid EVENT for " + key + " IGNORED");
                            } else if (sub.handler) {
                                sub.handler(verto, data.params, sub.userData);
                            } else if (verto.callbacks.onEvent) {
                                verto.callbacks.onEvent(verto, data.params, sub.userData);
                            } else {
                                console.log("EVENT:", data.params);
                            }
                        }
                    }

                    break;

                case "verto.info":
                    if (verto.callbacks.onMessage) {
                        verto.callbacks.onMessage(verto, null, $.verto.enum.message.info, data.params.msg);
                    }
                    //console.error(data);
                    console.debug("MESSAGE from: " + data.params.msg.from, data.params.msg.body);

                    break;

                default:
                    console.error("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", data.method);
                    break;
            }
        }
    };

    ENUM(s) {
        let i = 0,
            o = {};
        s.split(" ").map(function(x) {
            o[x] = {
                name: x,
                val: i++
            };
        });
        return Object.freeze(o);
    };

    /**
     *
     * @type {Array}
     */
    saved = [];

    /**
     *
     * @type {Array}
     */
    unloadJobs = [];


    // !!!!!!!! TODO: Rewrite this to ES6 !!!!!!!!!!!!!
    // $(window).bind('beforeunload', function() {
    //     for (var f in $.verto.unloadJobs) {
    //         $.verto.unloadJobs[f]();
    //     }
    //
    //     for (var i in $.verto.saved) {
    //         var verto = $.verto.saved[i];
    //         if (verto) {
    //             verto.purge();
    //             verto.logout();
    //         }
    //     }
    //
    //     return $.verto.warnOnUnload;
    // });

    /**
     *
     * @type {Array}
     */
    videoDevices = [];

    /**
     *
     * @type {Array}
     */
    audioInDevices = [];

    /**
     *
     * @type {Array}
     */
    audioOutDevices = [];

    /**
     *
     * @param runtime
     */
    checkDevices(runtime) {
        console.info("enumerating devices");
        let aud_in = [], aud_out = [], vid = [];

        if ((!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) && MediaStreamTrack.getSources) {
            MediaStreamTrack.getSources( (media_sources) => {
                for (let i = 0; i < media_sources.length; i++) {

                    if (media_sources[i].kind === 'video') {
                        vid.push(media_sources[i]);
                    } else {
                        aud_in.push(media_sources[i]);
                    }
                }

                this.videoDevices = vid;
                this.audioInDevices = aud_in;

                console.info("Audio Devices", this.audioInDevices);
                console.info("Video Devices", this.videoDevices);
                runtime(true);
            });
        } else {
            /* of course it's a totally different API CALL with different element names for the same exact thing */

            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                console.log("enumerateDevices() not supported.");
                return;
            }

            // List cameras and microphones.

            navigator.mediaDevices.enumerateDevices()
                .then( (devices) => {
                    devices.forEach(function(device) {
                        console.log(device);

                        console.log(device.kind + ": " + device.label +
                            " id = " + device.deviceId);

                        if (device.kind === "videoinput") {
                            vid.push({id: device.deviceId, kind: "video", label: device.label});
                        } else if (device.kind === "audioinput") {
                            aud_in.push({id: device.deviceId, kind: "audio_in", label: device.label});
                        } else if (device.kind === "audiooutput") {
                            aud_out.push({id: device.deviceId, kind: "audio_out", label: device.label});
                        }
                    });


                    this.videoDevices = vid;
                    this.audioInDevices = aud_in;
                    this.audioOutDevices = aud_out;

                    console.info("Audio IN Devices", this.audioInDevices);
                    console.info("Audio Out Devices", this.audioOutDevices);
                    console.info("Video Devices", this.videoDevices);
                    runtime(true);

                })
                .catch(function(err) {
                    console.log(" Device Enumeration ERROR: " + err.name + ": " + err.message);
                    runtime(false);
                });
        }
    };

    refreshDevices(runtime) {
        this.checkDevices(runtime);
    };

    /**
     *
     * @param obj
     * @param runtime
     */
    init(obj, runtime) {
        if (!obj) {
            obj = {};
        }

        if (!obj.skipPermCheck && !obj.skipDeviceCheck) {
            this.FSRTC.checkPerms(function(status) {
                this.checkDevices(runtime);
            }, true, true);
        } else if (obj.skipPermCheck && !obj.skipDeviceCheck) {
            this.checkDevices(runtime);
        } else if (!obj.skipPermCheck && obj.skipDeviceCheck) {
            this.FSRTC.checkPerms(function(status) {
                runtime(status);
            }, true, true);
        } else {
            runtime(null);
        }
    };

    /**
     *
     * @returns {*}
     */
    genUUID() {
        return generateGUID();
    };

}

export default Verto;

