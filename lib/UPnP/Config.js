'use strict';

const Homey = require('homey');

module.exports = {
    os: {
        name: 'Homey',
        version: Homey.version
    },
    app: {
        name: 'Yamaha',
        version: Homey.manifest.version
    },
    port: Homey.env.UPNP_EVENT_PORT
};