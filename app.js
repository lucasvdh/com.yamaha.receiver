'use strict';

const Homey = require('homey');
const Log = require('./lib/Log/Log');

class Yamaha extends Homey.App {

    onInit() {
        this.log('Yamaha app is running...');
        Log.init('https://187ffc76721948f1ba09566b3855b464@sentry.rapide.nl/17');

        this.onInitFlow();
    }

    onInitFlow() {

    }
}

module.exports = Yamaha;