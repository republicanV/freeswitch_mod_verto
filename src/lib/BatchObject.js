import JsonRpcClient from './jsonrpcclient';
/************************************************************************************************
 * Batch object with methods
 ************************************************************************************************/

/**
 * Handling object for batch calls.
 */

class BatchObject extends JsonRpcClient {
    constructor(jsonrpcclient, all_done_cb, error_cb) {
      super();
      // Array of objects to hold the call and notify requests.
      // Each objects will have the request
      // object, and unless it is a notify, success_cb and error_cb.
      this._requests   = [];

      this.jsonrpcclient = new JsonRpcClient();
      this.all_done_cb = all_done_cb;
      this.error_cb    = typeof error_cb === 'function' ? error_cb : function() {};
    }

    /**
     * @sa JsonRpcClient.prototype.call
     */
    call(method, params, success_cb, error_cb) {

        if (!params) {
            params = {};
        }

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        if (!success_cb) {
            success_cb = function(e){console.log("Success: ", e);};
        }

        if (!error_cb) {
            error_cb = function(e){console.log("Error: ", e);};
        }

        this._requests.push({
            request    : {
                jsonrpc : '2.0',
                method  : method,
                params  : params,
                id      : this.jsonrpcclient._current_id++  // Use the client's id series.
            },
            success_cb : success_cb,
            error_cb   : error_cb
        });
    };

    /**
     * @sa JsonRpcClient.prototype.notify
     */
    notify(method, params) {
        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        this._requests.push({
            request    : {
                jsonrpc : '2.0',
                method  : method,
                params  : params
            }
        });
    };

    /**
     * Executes the batched up calls.
     */
    _execute() {
        if (this._requests.length === 0) return; // All done :P

        // Collect all request data and sort handlers by request id.
        let batch_request = [];
        let handlers = {};
        let i = 0;
        let call;
        let success_cb;
        let error_cb;

        // If we have a WebSocket, just send the requests individually like normal calls.
        const socket = this.jsonrpcclient.options.getSocket(this.jsonrpcclient.wsOnMessage);
        if (socket !== null) {
            for (i = 0; i < this._requests.length; i++) {
                call = this._requests[i];
                success_cb = ('success_cb' in call) ? call.success_cb : undefined;
                error_cb   = ('error_cb'   in call) ? call.error_cb   : undefined;
                this.jsonrpcclient._wsCall(socket, call.request, success_cb, error_cb);
            }

            if (typeof all_done_cb === 'function') all_done_cb(result);
            return;
        }

        for (i = 0; i < this._requests.length; i++) {
            call = this._requests[i];
            batch_request.push(call.request);

            // If the request has an id, it should handle returns (otherwise it's a notify).
            if ('id' in call.request) {
                handlers[call.request.id] = {
                    success_cb : call.success_cb,
                    error_cb   : call.error_cb
                };
            }
        }

        success_cb = (data) => {
            this._batchCb(data, handlers, this.all_done_cb);
        };

        // No WebSocket, and no HTTP backend?  This won't work.
        if (this.jsonrpcclient.options.ajaxUrl === null) {
            throw "JsonRpcClient.batch used with no websocket and no http endpoint.";
        }

        // Send request
        axios.post(this.jsonrpcclient.options.ajaxUrl, {
            data : batch_request
        })
        .then(success_cb)
        .catch( (jqXHR, textStatus, errorThrown) => {
            this.error_cb(jqXHR, textStatus, errorThrown);
        });
    };

    /**
     * Internal helper to match the result array from a batch call to their respective callbacks.
     *
     * @fn _batchCb
     * @memberof JsonRpcClient
     */
    _batchCb(result, handlers, all_done_cb) {
        for (let i = 0; i < result.length; i++) {
            const response = result[i];

            // Handle error
            if ('error' in response) {
                if (response.id === null || !(response.id in handlers)) {
                    // An error on a notify?  Just log it to the console.
                    if ('console' in window) console.log(response);
                } else {
                    handlers[response.id].error_cb(response.error, this);
                }
            } else {
                // Here we should always have a correct id and no error.
                if (!(response.id in handlers) && 'console' in window) {
                    console.log(response);
                } else {
                    handlers[response.id].success_cb(response.result, this);
                }
            }
        }

        if (typeof all_done_cb === 'function') all_done_cb(result);
    };
}

export default BatchObject;