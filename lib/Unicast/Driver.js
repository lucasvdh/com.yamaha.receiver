'use strict';

const Homey = require('homey');
const Server = require('./Server');
const Event = require('./Event');
const Config = require('./Config');

class UnicastDriver extends Homey.Driver {

    onInit() {
        this.initUnicastServer().then(() => {
            this.log('UnicastDriver has been inited');
        }).catch(this.error);
    }

    onUnicastEvent(event, remote) {
        this.getDeviceByEvent(event).then(device => {
            device.onUnicastEvent(event, remote);
        }).catch(this.error);
    }

    getUnicastName() {
        return Config.name;
    }

    getUnicastPort() {
        return Config.port;
    }

    initUnicastServer() {
        return new Promise((resolve, reject) => {
            Homey.ManagerCloud.getLocalAddress().then(localAddress => {
                let ipAddress = localAddress.replace(/:\d+$/, '');

                this.unicastServer = new Server(ipAddress);
                this.unicastServer.setOnEventCallback(this.onUnicastEvent.bind(this));

                resolve();
            }).catch(reject);
        });

    }

    getDeviceByEvent(event) {
        return new Promise((resolve, reject) => {
            let devices = this.getDevices().filter(device => {
                return device.getNetworkId() === event.getDeviceId();
            });

            if (devices.length > 0) {
                resolve(devices.shift());
            } else {
                reject('Device not found');
            }
        });
    }
}

module.exports = UnicastDriver;