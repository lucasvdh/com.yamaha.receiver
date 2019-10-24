'use strict';

const Homey = require('homey');

class Yamaha extends Homey.App {

    onInit() {
        this.log('Yamaha app is running...');

        this.onInitFlow();
    }

    onInitFlow() {

    }
}

module.exports = Yamaha;