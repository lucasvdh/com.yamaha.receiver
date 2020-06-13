'use strict';

const Homey = require('homey');
const Log = require('./lib/Log/Log');

class Yamaha extends Homey.App {

    onInit() {
        this.log('Yamaha app is running...');
        this.onInitFlow();
    }

    onInitFlow() {

    }
}

module.exports = Yamaha;