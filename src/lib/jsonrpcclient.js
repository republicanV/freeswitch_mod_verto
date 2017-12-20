import 'axios';

/**
 * Json RPC Client class
 */

class JsonRpcClient {

    /**
     * @fn new
     *
     * @memberof JsonRpcClient
     *
     * @param options An object stating the backends:
     *                ajaxUrl    A url (relative or absolute) to a http(s) backend.
     *                socketUrl  A url (relative of absolute) to a ws(s) backend.
     *                onmessage  A socket message handler for other messages (non-responses).
     *                getSocket  A function returning a WebSocket or null.
     *                           It must take an onmessage_cb and bind it to the onmessage event
     *                           (or chain it before/after some other onmessage handler).
     *                           Or, it could return null if no socket is available.
     *                           The returned instance must have readyState <= 1, and if less than 1,
     *                           react to onopen binding.
     */

    constructor(options = {}) {
        this.options = {...this.options, ...options};
        console.log('JsonRpcClient__Options: ', this.options);
    }

    options = {
        ajaxUrl       : null,
        socketUrl     : null, ///< The ws-url for default getSocket.
        onmessage     : null, ///< Other onmessage-handler.
        login         : null, /// auth login
        passwd        : null, /// auth passwd
        sessid        : null,
        loginParams   : null,
        userVariables : null,
        getSocket     : function(onmessage_cb) {
            return this._getSocket(onmessage_cb);
        }
    };

    wsOnMessage(event) {
        this._wsOnMessage(event);
    };

    ws_cnt = 0;

    /// Holding the WebSocket on default getsocket.
    _ws_socket = null;

    /// Object <id>: { success_cb: cb, error_cb: cb }
    _ws_callbacks = {};

    /// The next JSON-RPC request id.
    _current_id = 1;

    speedTest(bytes, cb) {
        const socket = this.options.getSocket(this.wsOnMessage);
        if (socket !== null) {
            this.speedCB = cb;
            this.speedBytes = bytes;
            socket.send("#SPU " + bytes);

            const loops = bytes / 1024;
            const rem = bytes % 1024;
            let i;
            const data = new Array(1024).join(".");
            for (i = 0; i < loops; i++) {
                socket.send("#SPB " + data);
            }

            if (rem) {
                socket.send("#SPB " + data);
            }

            socket.send("#SPE");
        }
    };

    /**
     *
     * @param method     The method to run on JSON-RPC server.
     * @param params     The params; an array or object.
     * @param success_cb A callback for successful request.
     * @param error_cb   A callback for error.
     */

    call(method, params, success_cb, error_cb) {
        // Construct the JSON-RPC 2.0 request.

        if (!params) {
            params = {};
        }

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        let request = {
            jsonrpc : '2.0',
            method  : method,
            params  : params,
            id      : this._current_id++  // Increase the id counter to match request/response
        };

        if (!success_cb) {
            success_cb = function(e){console.log("Success: ", e);};
        }

        if (!error_cb) {
            error_cb = function(e){console.log("Error: ", e);};
        }

        // Try making a WebSocket call.
        const socket = this.options.getSocket(this.wsOnMessage);
        if (socket !== null) {
            this._wsCall(socket, request, success_cb, error_cb);
            return;
        }

        // No WebSocket, and no HTTP backend?  This won't work.
        if (this.options.ajaxUrl === null) {
            throw "$.JsonRpcClient.call used with no websocket and no http endpoint.";
        }

        axios.post(this.options.ajaxUrl, {
            data: request
        })
        .then(function(data) {
            if ('error' in data) error_cb(data.error, this);
            success_cb(data.result, this);
        })
        // JSON-RPC Server could return non-200 on error
        .catch(function(error) {
            console.log(error);
        });
    };

    /**
     * Notify sends a command to the server that won't need a response.  In http, there is probably
     * an empty response - that will be dropped, but in ws there should be no response at all.
     *
     * This is very similar to call, but has no id and no handling of callbacks.
     *
     * @fn notify
     * @memberof JsonRpcClient
     *
     * @param method     The method to run on JSON-RPC server.
     * @param params     The params; an array or object.
     */

    notify(method, params) {
        // Construct the JSON-RPC 2.0 request.

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        let request = {
            jsonrpc: '2.0',
            method:  method,
            params:  params
        };

        // Try making a WebSocket call.
        const socket = this.options.getSocket(this.wsOnMessage);
        if (socket !== null) {
            this._wsCall(socket, request);
            return;
        }

        // No WebSocket, and no HTTP backend?  This won't work.
        if (this.options.ajaxUrl === null) {
            throw "$.JsonRpcClient.notify used with no websocket and no http endpoint.";
        }

        axios.post(this.options.ajaxUrl, {
            data : request
        });
    };

    /**
     * Make a batch-call by using a callback.
     *
     * The callback will get an object "batch" as only argument.  On batch, you can call the methods
     * "call" and "notify" just as if it was a normal JsonRpcClient object, and all calls will be
     * sent as a batch call then the callback is done.
     *
     * @fn batch
     * @memberof JsonRpcClient
     *
     * @param callback    The main function which will get a batch handler to run call and notify on.
     * @param all_done_cb A callback function to call after all results have been handled.
     * @param error_cb    A callback function to call if there is an error from the server.
     *                    Note, that batch calls should always get an overall success, and the
     *                    only error
     */

    batch(callback, all_done_cb, error_cb) {
        const batch = new JsonRpcClient._batchObject(this, all_done_cb, error_cb);
        callback(batch);
        batch._execute();
    };

    /**
     * The default getSocket handler.
     *
     * @param onmessage_cb The callback to be bound to onmessage events on the socket.
     *
     * @fn _getSocket
     * @memberof JsonRpcClient
     */

    socketReady() {
        if (this._ws_socket === null || this._ws_socket.readyState > 1) {
            return false;
        }
        return true;
    };

    closeSocket() {
        if (this.socketReady()) {
            this._ws_socket.onclose = function (w) {
                console.log("Closing Socket");
            };
            this._ws_socket.close();
        }
    };

    loginData(params) {
        this.options.login = params.login;
        this.options.passwd = params.passwd;
        this.options.loginParams = params.loginParams;
        this.options.userVariables = params.userVariables;
    };

    connectSocket(onmessage_cb) {
        if (this.to) {
            clearTimeout(this.to);
        }

        if (!this.socketReady()) {
            this.authing = false;

            if (this._ws_socket) {
                delete this._ws_socket;
            }

            // No socket, or dying socket, let's get a new one.
            this._ws_socket = new WebSocket(this.options.socketUrl);

            if (this._ws_socket) {
                // Set up onmessage handler.
                this._ws_socket.onmessage = onmessage_cb;
                this._ws_socket.onclose = (w) => {
                    if (!this.ws_sleep) {
                        this.ws_sleep = 1000;
                    }

                    if (this.options.onWSClose) {
                        this.options.onWSClose(this);
                    }

                    console.error("Websocket Lost " + this.ws_cnt + " sleep: " + this.ws_sleep + "msec");

                    this.to = setTimeout( () => {
                        console.log("Attempting Reconnection....");
                        this.connectSocket(onmessage_cb);
                    }, this.ws_sleep);

                    this.ws_cnt++;

                    if (this.ws_sleep < 3000 && (this.ws_cnt % 10) === 0) {
                        this.ws_sleep += 1000;
                    }
                };

                // Set up sending of message for when the socket is open.
                this._ws_socket.onopen = () => {
                    if (this.to) {
                        clearTimeout(this.to);
                    }
                    this.ws_sleep = 1000;
                    this.ws_cnt = 0;
                    if (this.options.onWSConnect) {
                        this.options.onWSConnect(this);
                    }

                    let req;
                    // Send the requests.
                    while ((req = this.q.pop())) {
                        this._ws_socket.send(req);
                    }
                };
            }
        }

        return this._ws_socket ? true : false;
    };

    _getSocket(onmessage_cb) {
        // If there is no ws url set, we don't have a socket.
        // Likewise, if there is no window.WebSocket.
        if (this.options.socketUrl === null || !("WebSocket" in window)) return null;

        this.connectSocket(onmessage_cb);

        return this._ws_socket;
    };

    /**
     * Queue to save messages delivered when websocket is not ready
     */
    q = [];

    /**
     * Internal handler to dispatch a JRON-RPC request through a websocket.
     *
     * @fn _wsCall
     * @memberof JsonRpcClient
     */

    _wsCall(socket, request, success_cb, error_cb) {
        const request_json = JSON.stringify(request);

        if (socket.readyState < 1) {
            // The websocket is not open yet; we have to set sending of the message in onopen.
            //self = this; // In closure below, this is set to the WebSocket.  Use self instead.
            this.q.push(request_json);
        } else {
            // We have a socket and it should be ready to send on.
            socket.send(request_json);
        }

        // Setup callbacks.  If there is an id, this is a call and not a notify.
        if ('id' in request && typeof success_cb !== 'undefined') {
            this._ws_callbacks[request.id] = { request: request_json, request_obj: request, success_cb: success_cb, error_cb: error_cb };
        }
    };

    /**
     * Internal handler for the websocket messages.  It determines if the message is a JSON-RPC
     * response, and if so, tries to couple it with a given callback.  Otherwise, it falls back to
     * given external onmessage-handler, if any.
     *
     * @param event The websocket onmessage-event.
     */

    _wsOnMessage(event) {
        // Check if this could be a JSON RPC message.
        let response;

        // Special sub proto
        if (event.data[0] === "#" && event.data[1] === "S" && event.data[2] === "P") {
            if (event.data[3] === "U") {
                this.up_dur = parseInt(event.data.substring(4));
            } else if (this.speedCB && event.data[3] === "D") {
                this.down_dur = parseInt(event.data.substring(4));

                const up_kps = (((this.speedBytes * 8) / (this.up_dur / 1000)) / 1024).toFixed(0);
                const down_kps = (((this.speedBytes * 8) / (this.down_dur / 1000)) / 1024).toFixed(0);

                console.info("Speed Test: Up: " + up_kps + " Down: " + down_kps);
                this.speedCB(
                    event,
                    {
                        upDur: this.up_dur,
                        downDur: this.down_dur,
                        upKPS: up_kps,
                        downKPS: down_kps
                    }
                );
                this.speedCB = null;
            }

            return;
        }

        try {
            response = JSON.parse(event.data);

            /// @todo Make using the jsonrcp 2.0 check optional, to use this on JSON-RPC 1 backends.

            if (typeof response === 'object' &&
                'jsonrpc' in response &&
                response.jsonrpc === '2.0') {

                /// @todo Handle bad response (without id).

                // If this is an object with result, it is a response.
                if ('result' in response && this._ws_callbacks[response.id]) {
                    // Get the success callback.
                    let success_cb = this._ws_callbacks[response.id].success_cb;

                    // Delete the callback from the storage.
                    delete this._ws_callbacks[response.id];

                    // Run callback with result as parameter.
                    success_cb(response.result, this);
                    return;
                } else if ('error' in response && this._ws_callbacks[response.id]) {
                    // If this is an object with error, it is an error response.

                    // Get the error callback.
                    let error_cb = this._ws_callbacks[response.id].error_cb;
                    let orig_req = this._ws_callbacks[response.id].request;

                    // if this is an auth request, send the credentials and resend the failed request
                    if (
                        !this.authing && response.error.code === -32000 && this.options.login && this.options.passwd)
                        {
                            this.authing = true;

                            this.call(
                                "login",
                                {
                                    login: this.options.login,
                                    passwd: this.options.passwd,
                                    loginParams: this.options.loginParams,
                                    userVariables: this.options.userVariables
                                },

                                this._ws_callbacks[response.id].request_obj.method === "login" ?

                                (e) => {
                                    this.authing = false;
                                    console.log("logged in");
                                    delete this._ws_callbacks[response.id];

                                    if (this.options.onWSLogin) {
                                        this.options.onWSLogin(true, this);
                                    }
                                }

                                :

                                (e) => {
                                    this.authing = false;
                                    console.log("logged in, resending request id: " + response.id);
                                    const socket = this.options.getSocket(this.wsOnMessage);
                                    if (socket !== null) {
                                        socket.send(orig_req);
                                    }
                                    if (this.options.onWSLogin) {
                                        this.options.onWSLogin(true, this);
                                    }
                                },

                                function(e) {
                                    console.log("error logging in, request id:", response.id);
                                    delete self._ws_callbacks[response.id];
                                    error_cb(response.error, this);

                                    if (self.options.onWSLogin) {
                                        self.options.onWSLogin(false, self);
                                    }
                                }
                            ); // end of this.call

                            return;
                        } // end if

                    // Delete the callback from the storage.
                    delete this._ws_callbacks[response.id];

                    // Run callback with the error object as parameter.
                    error_cb(response.error, this);
                    return;
                }
            }
        } catch (err) {
            // Probably an error while parsing a non json-string as json.  All real JSON-RPC cases are
            // handled above, and the fallback method is called below.
            console.log("ERROR: " + err);
            return;
        }

        // This is not a JSON-RPC response.  Call the fallback message handler, if given.
        if (typeof this.options.onmessage === 'function') {
            event.eventData = response;
            if (!event.eventData) {
                event.eventData = {};
            }

            const reply = this.options.onmessage(event);

            if (reply && typeof reply === "object" && event.eventData.id) {
                let msg = {
                    jsonrpc: "2.0",
                    id: event.eventData.id,
                    result: reply
                };

                const socket = this.options.getSocket(this.wsOnMessage);
                if (socket !== null) {
                    socket.send(JSON.stringify(msg));
                }
            }
        }
    };

    /************************************************************************************************
     * Batch object with methods
     ************************************************************************************************/

    /**
     * Handling object for batch calls.
     */



}

export default JsonRpcClient;