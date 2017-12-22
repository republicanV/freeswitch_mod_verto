import LiveArray from './LiveArray';

class LiveTable extends LiveArray {
    constructor(verto, context, name, jq, config) {
        super();

        this.la = new LiveArray(verto, context, name, {
            subParams: config.subParams
        });

        this.liveArray = this.la;
        this.dataTable = this.dt;
        this.verto = verto;

        this.onErr = this.la.onErr();

        this.onChange = this.la.onChange();
        this.onChange(this.la, {
            action: "init"
        });
     }

    dt;

    destroy() {
        if (this.dt) {
            this.dt.fnDestroy();
        }
        if (this.la) {
            super.destroy();
        }

        this.dt = null;
        this.la = null;
    };

    onErr(obj, args) {
        console.error("Error: ", obj, args);
    };

    onChange(obj, args) {
        let index = 0;
        let iserr = 0;

        if (!this.dt) {
            if (!config.aoColumns) {
                if (args.action !== "init") {
                    return;
                }

                config.aoColumns = [];

                for (let i in args.data) {
                    config.aoColumns.push({
                        "sTitle": args.data[i]
                    });
                }
            }

            this.dt = jq.dataTable(config);
        }

        if (this.dt && (args.action === "del" || args.action === "modify")) {
            index = args.index;

            if (index === undefined && args.key) {
                index = this.la.indexOf(args.key);
            }

            if (index === undefined) {
                console.error("INVALID PACKET Missing INDEX\n", args);
                return;
            }
        }

        if (config.onChange) {
            config.onChange(obj, args);
        }

        try {
            switch (args.action) {
                case "bootObj":
                    if (!args.data) {
                        console.error("missing data");
                        return;
                    }
                    this.dt.fnClearTable();
                    this.dt.fnAddData(this.genArray(obj));
                    this.dt.fnAdjustColumnSizing();
                    break;
                case "add":
                    if (!args.data) {
                        console.error("missing data");
                        return;
                    }
                    if (args.redraw > -1) {
                        // specific position, more costly
                        this.dt.fnClearTable();
                        this.dt.fnAddData(this.genArray(obj));
                    } else {
                        this.dt.fnAddData(this.genRow(args.data));
                    }
                    this.dt.fnAdjustColumnSizing();
                    break;
                case "modify":
                    if (!args.data) {
                        return;
                    }
                    //console.debug(args, index);
                    this.dt.fnUpdate(this.genRow(args.data), index);
                    this.dt.fnAdjustColumnSizing();
                    break;
                case "del":
                    this.dt.fnDeleteRow(index);
                    this.dt.fnAdjustColumnSizing();
                    break;
                case "clear":
                    this.dt.fnClearTable();
                    break;
                case "reorder":
                    // specific position, more costly
                    this.dt.fnClearTable();
                    this.dt.fnAddData(this.genArray(obj));
                    break;
                case "hide":
                    // TODO: overwrite this with ES6
                    jq.hide();
                    break;

                case "show":
                    // TODO: overwrite this with ES6
                    jq.show();
                    break;

            }
        } catch(err) {
            console.error("ERROR: " + err);
            iserr++;
        }

        if (iserr) {
            obj.errs++;
            if (obj.errs < 3) {
                obj.bootstrap(obj.user_obj);
            }
        } else {
            obj.errs = 0;
        }

    };

    genRow = (data) => {
        if (typeof(data[4]) === "string" && data[4].indexOf("{") > -1) {
            let tmp = JSON.parse(data[4]);
            data[4] = tmp.oldStatus;
            data[5] = null;
        }
        return data;
    };

    genArray = (obj) => {
        let data = obj.asArray();

        for (let i in data) {
            data[i] = this.genRow(data[i]);
        }

        return data;
    };

    liveTable = function(verto, context, name, jq, config) {
        // var dt;
        // var la = new $.verto.liveArray(verto, context, name, {
        //     subParams: config.subParams
        // });
        // var lt = this;

        // lt.liveArray = la;
        // lt.dataTable = dt;
        // lt.verto = verto;



        // la.onErr = function(obj, args) {
        //     console.error("Error: ", obj, args);
        // };

        /* back compat so jsonstatus can always be enabled */

    };
}

export default LiveTable;