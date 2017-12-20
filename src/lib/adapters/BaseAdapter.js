
class BaseAdapter {

    constraints = {
        options: [{ DtlsSrtpKeyAgreement: true }, { RtpDataChannels: true }],
        optional: [{
            'DtlsSrtpKeyAgreement': 'true',
        }],mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: false,
        }
    };

    getClassName() {
        return BaseAdapter.name;
    }

    getContraints() {
        return this.constraints;
    }
}

export default BaseAdapter;
