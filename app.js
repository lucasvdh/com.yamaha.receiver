'use strict';

const Homey = require('homey');
const Log = require('homey-log').Log;

class Yamaha extends Homey.App {

    onInit() {
        this.log('Yamaha app is running...');

        this.onInitFlow();
    }

    onInitFlow() {

    }
}

module.exports = Yamaha;