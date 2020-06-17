'use strict';

const Homey = require('homey');
const Server = require('./EventServer');
// const Event = require('./Event');
const Config = require('./Config');

class UPnPDriver extends Homey.Driver {

    onInit() {
        this.initEventServer().then(() => {
            this.log('UPnPDriver has been inited');
        }).catch(this.error);
    }

    onUnicastEvent(event, remote) {
        console.log(event);

        // this.getDeviceByEvent(event).then(device => {
        //     device.onUnicastEvent(event, remote);
        // }).catch(this.error);
    }

    getUnicastName() {
        return Config.name;
    }

    getUnicastPort() {
        return Config.port;
    }

    initEventServer() {
        return new Promise((resolve, reject) => {
            Homey.ManagerCloud.getLocalAddress().then(localAddress => {
                let ipAddress = localAddress.replace(/:\d+$/, '');

                this.eventServer = new Server(ipAddress);
                this.eventServer.setOnEventCallback(this.onUnicastEvent.bind(this));

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

module.exports = UPnPDriver;