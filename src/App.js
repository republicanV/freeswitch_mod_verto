import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import SipClientCtrl  from './SipClient/SipClientCtrl';


class App extends Component {
  render() {
    return (
      <div className="App">
          <SipClientCtrl/>
      </div>
    );
  }
}

export default App;
