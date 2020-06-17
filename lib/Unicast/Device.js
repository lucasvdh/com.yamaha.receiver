'use strict';

const Homey = require('homey');
const Config = require('./Config');

class UnicastDevice extends Homey.Device {

    getUnicastName() {
        return Config.name;
    }

    getUnicastPort() {
        return Config.port;
    }

}

module.exports = UnicastDevice;