import HashArray from './HashArray';
import Verto from './verto';

class LiveArray extends HashArray {
    constructor(verto, context, name, config) {
        super();

        this.user_obj = config.userObj;
        this.context = context;
        this.name = name;
        this.user_obj = user_obj;

        // Save the hashArray add, del, reorder, clear methods so we can make our own.
        this._add = super.add;
        this._del = super.del;
        this._reorder = super.reorder;
        this._clear = super.clear;

        /**
         *
         * @type {Verto}
         */
        this.verto = new Verto();

        if (this.context) {
            this.binding = this.verto.subscribe(this.context, {
                handler: this.eventHandler,
                userData: this,
                subParams: config.subParams
            });
        }

        this.bootstrap(this.user_obj);
    }

    /**
     *
     * @type {number}
     */
    lastSerno = 0;

    /**
     *
     * @type {null}
     */
    binding = null;

    /**
     *
     * @type {boolean}
     */
    local = false;

    /**
     *
     * @type {number}
     */
    errs = 0;

    /**
     *
     * @param channel
     * @param obj
     */
    broadcast(channel, obj) {
        this.verto.broadcast(channel, obj);
    };

    /**
     *
     */
    clear() {
        this._clear();
        this.lastSerno = 0;

        if (this.onChange) {
            this.onChange(this, {
                action: "clear"
            });
        }
    };

    /**
     *
     * @param serno
     * @returns {boolean}
     */
    checkSerno(serno) {
        if (serno < 0) {
            return true;
        }

        if (this.lastSerno > 0 && serno !== (this.lastSerno + 1)) {
            if (this.onErr) {
                this.onErr(this, {
                    lastSerno: this.lastSerno,
                    serno: serno
                });
            }
            this.errs++;
            console.debug(this.errs);
            if (this.errs < 3) {
                this.bootstrap(this.user_obj);
            }
            return false;
        } else {
            this.lastSerno = serno;
            return true;
        }
    };

    /**
     *
     * @param serno
     * @param a
     */
    reorder(serno, a) {
        if (this.checkSerno(serno)) {
            this._reorder(a);
            if (this.onChange) {
                this.onChange(this, {
                    serno: serno,
                    action: "reorder"
                });
            }
        }
    };

    /**
     *
     * @param serno
     * @param val
     * @param key
     * @param index
     */
    static init(serno, val, key, index) {
        if (key === null || key === undefined) {
            key = serno;
        }
        if (this.checkSerno(serno)) {
            if (this.onChange) {
                this.onChange(la, {
                    serno: serno,
                    action: "init",
                    index: index,
                    key: key,
                    data: val
                });
            }
        }
    };

    /**
     *
     * @param serno
     * @param val
     */
    bootObj(serno, val) {
        if (this.checkSerno(serno)) {

            //la.clear();
            for (let i in val) {
                this._add(val[i][0], val[i][1]);
            }

            if (this.onChange) {
                this.onChange(this, {
                    serno: serno,
                    action: "bootObj",
                    data: val,
                    redraw: true
                });
            }
        }
    };

    /**
     *
     * @param serno
     * @param val
     * @param key
     * @param index
     */
    add(serno, val, key, index) {
        if (key === null || key === undefined) {
            key = serno;
        }
        if (this.checkSerno(serno)) {
            let redraw = this._add(key, val, index);
            if (this.onChange) {
                this.onChange(this, {
                    serno: serno,
                    action: "add",
                    index: index,
                    key: key,
                    data: val,
                    redraw: redraw
                });
            }
        }
    };

    /**
     *
     * @param serno
     * @param val
     * @param key
     * @param index
     */
    modify(serno, val, key, index) {
        if (key === null || key === undefined) {
            key = serno;
        }
        if (this.checkSerno(serno)) {
            this._add(key, val, index);
            if (this.onChange) {
                this.onChange(this, {
                    serno: serno,
                    action: "modify",
                    key: key,
                    data: val,
                    index: index
                });
            }
        }
    };

    del(serno, key, index) {
        if (key === null || key === undefined) {
            key = serno;
        }
        if (this.checkSerno(serno)) {
            if (index === null || index < 0 || index === undefined) {
                index = this.indexOf(key);
            }
            let ok = this._del(key);

            if (ok && this.onChange) {
                this.onChange(this, {
                    serno: serno,
                    action: "del",
                    key: key,
                    index: index
                });
            }
        }
    };

    /**
     *
     * @param v
     * @param e
     * @param la === this
     */
    eventHandler(v, e, la) {
        let packet = e.data;

        //console.error("READ:", packet);

        if (packet.name !== la.name) {
            return;
        }

        switch (packet.action) {

            case "init":
                this.init(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                break;

            case "bootObj":
                this.bootObj(packet.wireSerno, packet.data);
                break;
            case "add":
                this.add(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                break;

            case "modify":
                if (! (packet.arrIndex || packet.hashKey)) {
                    console.error("Invalid Packet", packet);
                } else {
                    this.modify(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                }
                break;
            case "del":
                if (! (packet.arrIndex || packet.hashKey)) {
                    console.error("Invalid Packet", packet);
                } else {
                    this.del(packet.wireSerno, packet.hashKey, packet.arrIndex);
                }
                break;

            case "clear":
                this.clear();
                break;

            case "reorder":
                this.reorder(packet.wireSerno, packet.order);
                break;

            default:
                if (this.checkSerno(packet.wireSerno)) {
                    if (this.onChange) {
                        this.onChange(this, {
                            serno: packet.wireSerno,
                            action: packet.action,
                            data: packet.data
                        });
                    }
                }
                break;
        }
    };

    /**
     *
     */
    static destroy () {
        this._clear();
        this.verto.unsubscribe(this.binding);
    };

    /**
     *
     * @param cmd
     * @param obj
     */
    sendCommand(cmd, obj) {
        // var self = la;
        this.broadcast(this.context, {
            liveArray: {
                command: cmd,
                context: this.context,
                name: this.name,
                obj: obj
            }
        });
    };

    /**
     *
     * @param obj
     */
    bootstrap(obj) {
        // var self = la;
        this.sendCommand("bootstrap", obj);
        //self.heartbeat();
    };

    /**
     *
     * @param obj
     */
    changepage(obj) {
        // var self = la;
        this.clear();
        this.broadcast(this.context, {
            liveArray: {
                command: "changepage",
                context: this.context,
                name: this.name,
                obj: obj
            }
        });
    };

    heartbeat(obj) {
        // var self = la;

        let callback = () => {
            this.heartbeat.call(this, obj);
        };
        this.broadcast(this.context, {
            liveArray: {
                command: "heartbeat",
                context: this.context,
                name: this.name,
                obj: obj
            }
        });
        this.hb_pid = setTimeout(callback, 30000);
    };

    // la.bootstrap(la.user_obj);
}



export default LiveArray;