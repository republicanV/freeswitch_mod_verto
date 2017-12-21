import generateGUID from './generateGuid';
import FSRTC from './FSRTC';
import JsonRpcClient from './jsonrpcclient'

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

        if (this.options.deviceParams.useCamera) {
            FSRTC.getValidRes(this.options.deviceParams.useCamera, this.options.deviceParams.onResCheck);
        }

        if (this.options.deviceParams.useCamera) {
            FSRTC.getValidRes(this.options.deviceParams.useCamera, this.options.deviceParams.onResCheck);
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

    deviceParams(obj) {
        for (let i in obj) {
            this.options.deviceParams[i] = obj[i];
        }

        if (obj.useCamera) {
            FSRTC.getValidRes(this.options.deviceParams.useCamera, obj ? obj.onResCheck : undefined);
        }
    };

    videoParams(obj) {
        for (let i in obj) {
            this.options.videoParams[i] = obj[i];
        }
    };
}

export default Verto;

