'use strict';

const dgram = require('dgram');
const Config = require('./Config');
const Event = require('./Event');
const Log = require('../Log');

class Server {

    constructor(unicastAddress, unicastPort = null, onEventCallback = null) {
        this.unicastAddress = unicastAddress;
        this.unicastPort = (unicastPort === null) ? Config.port : unicastPort;
        this.onEventCallback = onEventCallback;

        this.init();
    }

    init() {
        this.socket = dgram.createSocket('udp4');
        this.socket.bind(this.unicastPort, this.unicastAddress);
        this.socket.on('message', (data, rinfo) => {
            try {
                this.onUnicastEvent(new Event(JSON.parse(data)), rinfo);
            } catch (e) {
                this.onError(e);
            }
        });
        this.socket.on('error', (error) => {
            this.onError(error);
        });
    }

    setOnEventCallback(onEventCallback) {
        this.onEventCallback = onEventCallback;
    }

    setOnErrorCallback(onErrorCallback) {
        this.onErrorCallback = onErrorCallback;
    }

    setPort(unicastPort) {
        this.unicastPort = unicastPort;
        this.rebind();
    }

    onUnicastEvent(event, rinfo) {
        if (typeof this.onEventCallback === 'function') {
            this.onEventCallback(event, rinfo);
        }
    }

    onError(error) {
        Log.captureException(error);

        if (typeof this.onErrorCallback === 'function') {
            this.onErrorCallback(error);
        }
    }

    rebind() {
        this.socket.close();
        this.init();
    }

    stop() {
        this.socket.close();
    }
}

module.exports = Server;