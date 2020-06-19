'use strict';

const Homey = require('homey');

module.exports = {
    name: Homey.manifest.version + '(Homey)',
    port: Homey.env.UNICAST_PORT
};