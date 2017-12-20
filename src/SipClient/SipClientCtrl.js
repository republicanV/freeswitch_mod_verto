import React, {Component} from 'react';
import SipClientView  from './SipClientView';
import FSRTC from './../lib/FSRTC';
import detect from 'detect-browser'

class SipClientCtrl extends Component {

    HOST_URI = 'ws:149.56.20.86:8081';

    render() {
        const browser = detect.detect();
        // console.log(detect.detect());
        new FSRTC({screenShare:true}, browser);
        return (
            <div>
                <div>
                    <span>Browser name : </span><span>{ browser.name }</span>
                </div>
                <SipClientView/>
            </div>
        );
    }
}


export default SipClientCtrl;
