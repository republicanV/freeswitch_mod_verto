import Verto from './verto';

class HashArray extends Verto {
    constructor() {
        super();
    }

    hash = {};
    array = [];

    static reorder(a) {
        this.array = a;
        let h = this.hash;
        this.hash = {};

        const len = this.array.length;

        for (let i = 0; i < len; i++) {
            let key = this.array[i];
            if (h[key]) {
                this.hash[key] = h[key];
                delete h[key];
            }
        }
        h = undefined;
    };

    static clear() {
        this.hash = undefined;
        this.array = undefined;
        this.hash = {};
        this.array = [];
    };

    static add(name, val, insertAt) {
        let redraw = false;

        if (!this.hash[name]) {
            if (insertAt === undefined || insertAt < 0 || insertAt >= this.array.length) {
                this.array.push(name);
            } else {
                let x = 0;
                let n = [];
                const len = this.array.length;

                for (let i = 0; i < len; i++) {
                    if (x++ === insertAt) {
                        n.push(name);
                    }
                    n.push(this.array[i]);
                }

                this.array = undefined;
                this.array = n;
                n = undefined;
                redraw = true;
            }
        }

        this.hash[name] = val;

        return redraw;
    };

    static del(name) {
        let r = false;

        if (this.hash[name]) {
            this.array = this.del_array(this.array, name);
            delete this.hash[name];
            r = true;
        } else {
            console.error("can't del nonexistant key " + name);
        }

        return r;
    };

    get(name) {
        return this.hash[name];
    };

    order() {
        return this.array;
    };

    // hash = () => {
    //     return this.hash;
    // };

    indexOf(name) {
        const len = this.array.length;

        for (let i = 0; i < len; i++) {
            if (this.array[i] === name) {
                return i;
            }
        }
    };

    arrayLen() {
        return this.array.length;
    };

    asArray() {
        let r = [];
        const len = this.array.length;

        for (let i = 0; i < len; i++) {
            let key = this.array[i];
            r.push(this.hash[key]);
        }

        return r;
    };

    each(cb) {
        let len = this.array.length;

        for (let i = 0; i < len; i++) {
            cb(this.array[i], this.hash[this.array[i]]);
        }
    };

    dump(html) {
        let str = "";

        this.each(function(name, val) {
            str += "name: " + name + " val: " + JSON.stringify(val) + (html ? "<br>" : "\n");
        });

        return str;
    };
}

export default HashArray;