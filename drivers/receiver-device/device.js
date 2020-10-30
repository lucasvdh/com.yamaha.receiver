"use strict";

const YamahaReceiver = require('../../lib/YamahaReceiver');

class YamahaReceiverDevice extends YamahaReceiver.Device {

    /**
     * @returns Client
     */
    getClient() {
        if (typeof this._yamahaReceiverClient === "undefined" || this._yamahaReceiverClient === null) {
            this._yamahaReceiverClient = new YamahaReceiver.Client(this.getURLBase(), this.getControlURL());
        }

        return this._yamahaReceiverClient;
    }

    getZone() {
        return this.getCapabilityValue('receiver_zone') || 'Main_Zone';
    }

    setZone(zone) {
        return new Promise((resolve, reject) => {
            this.getClient().setZone(zone).then(resolve).catch(error => {
                if (error instanceof YamahaReceiver.Errors.InvalidZone) {
                    reject(new Error(Homey.__('error.invalidZone', {zone: zone})));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    registerListeners() {
        super.registerListeners();

        this.registerCapabilityListener('receiver_zone', zone => {
            return this.setZone(zone);
        });
    }

}

module.exports = YamahaReceiverDevice;
