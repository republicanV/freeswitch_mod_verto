import Verto from './verto';

class Conf extends Verto {
    constructor(verto, params) {
        super();

        this.params = {...this.params, ...params};

        this.verto = verto;
        this.serno = CONFMAN_SERNO++;

        this.subscribe = super.subscribe(this.params.laData.modChannel, {
            handler: function() {
                if (this.params.onBroadcast) {
                    this.params.onBroadcast(verto, this, e.data);
                }
            }
        });

        createMainModeratorMethods();
    }

    params = {
        dialog: null,
        hasVid: false,
        laData: null,
        onBroadcast: null,
        onLaChange: null,
        onLaRow: null
    };

    subscribe();
}

export default Conf;

// $.verto.conf = function(verto, params) {
//     var conf = this;
//
//     conf.params = $.extend({
//         dialog: null,
//         hasVid: false,
//         laData: null,
//         onBroadcast: null,
//         onLaChange: null,
//         onLaRow: null
//     }, params);
//
//     conf.verto = verto;
//     conf.serno = CONFMAN_SERNO++;
//
//     createMainModeratorMethods();
//
//     verto.subscribe(conf.params.laData.modChannel, {
//         handler: function(v, e) {
//             if (conf.params.onBroadcast) {
//                 conf.params.onBroadcast(verto, conf, e.data);
//             }
//         }
//     });
//
//     verto.subscribe(conf.params.laData.chatChannel, {
//         handler: function(v, e) {
//             if (typeof(conf.params.chatCallback) === "function") {
//                 conf.params.chatCallback(v,e);
//             }
//         }
//     });
// };