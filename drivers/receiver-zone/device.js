"use strict";

const YamahaReceiver = require('../../lib/YamahaReceiver');

class YamahaReceiverDevice extends YamahaReceiver.Device {

    /**
     * @returns Client
     */
    getClient() {
        if (typeof this._yamahaReceiverClient === "undefined" || this._yamahaReceiverClient === null) {
            this._yamahaReceiverClient = new YamahaReceiver.Client(this.getURLBase(), this.getControlURL(), this.getZone());
        }

        return this._yamahaReceiverClient;
    }

}

module.exports = YamahaReceiverDevice;
