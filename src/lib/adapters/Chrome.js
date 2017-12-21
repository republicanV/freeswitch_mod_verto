import BaseAdapter from './BaseAdapter';

class  Chrome extends BaseAdapter {
    constructor(m) {
        super(m);

    }
    getContraints() {
        return super.getContraints();
    }


    constraints = {
        offerToReceiveAudio : true,
        offerToReceiveVideo : true
    };

    getClassName() {
        return Chrome.name;
    }

}

export default Chrome;
