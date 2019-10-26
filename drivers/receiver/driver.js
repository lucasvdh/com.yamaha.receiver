'use strict';

const Homey = require('homey');
const axios = require('axios');
const xml2js = require('xml2js');
const YamahaReceiverClient = require('../../lib/YamahaReceiver/YamahaReceiverClient.js');

// A list of devices, with their 'id' as key
// it is generally advisable to keep a list of
// paired and active devices in your driver's memory.
let devices = {};

class YamahaReceiverDriver extends Homey.Driver {

    init(devices_data, callback) {
        devices_data.forEach((device_data) => {
            try {
                this.initDevice(device_data);
            } catch (e) {
                //Nothing here, just catching errors
            }
        });

        callback();
    }

    onInit() {
        this.log('YamahaReceiverDriver has been inited');
    }

    // a helper method to add a device to the devices list
    initDevice(device_data) {
        devices[device_data.id] = {};
        devices[device_data.id].state = {onoff: false};
        devices[device_data.id].data = device_data;
    }

    onPair(socket) {
        const discoveryStrategy = this.getDiscoveryStrategy();

        let defaultIP = '192.168.1.2',
            defaultZone = 'Main_Zone',
            pairingDevice = {
                name: 'Yamaha amplifier',
                data: {
                    driver: "receiver",
                    ipAddress: defaultIP,
                    zone: defaultZone
                },
                settings: {
                    ipAddress: defaultIP,
                    zone: defaultZone
                },
            };

        // this method is run when Homey.emit('list_devices') is run on the front-end
        // which happens when you use the template `list_devices`
        socket.on('list_devices', (data, callback) => {
            const discoveryResults = discoveryStrategy.getDiscoveryResults();

            Promise.all(Object.values(discoveryResults).map(discoveryResult => {
                return this.getDeviceByDiscoveryResult(discoveryResult);
            })).then((devices) => {
                console.log(devices);
                callback(null, devices);
            }).catch(callback);
        });

        // this is called when the user presses save settings button in start.html
        socket.on('get_devices', (data, callback) => {
            // Continue to next view
            socket.showView('validate');

            this.validateIPAddress(data.ipAddress, data.zone).then(() => {
                pairingDevice.data.id = data.ipAddress + '[' + data.zone + ']';
                pairingDevice.data.ipAddress = data.ipAddress;
                pairingDevice.data.zone = data.zone;
                pairingDevice.settings = {
                    ipAddress: data.ipAddress,
                    zone: data.zone,
                    updateInterval: 5
                };

                socket.showView('list_devices');
            }).catch((error) => {
                console.log(error);
                socket.showView('start');

                if (error.code === 'EHOSTUNREACH') {
                    socket.emit('error', 'host_unreachable');
                } else if (parseInt(error.statusCode) === 400) {
                    socket.emit('error', 'invalid_zone');
                } else {
                    socket.emit('error', 'error');
                }
            });
        });


        socket.on('get_device', (data, callback) => {
            callback(null, pairingDevice);
        });

        socket.on('disconnect', () => {
            this.log("Yamaha receiver app - User aborted pairing, or pairing is finished");
        });
    }

    added(device_data, callback) {
        this.initDevice(device_data);
        callback(null, true);
    }

    deleted(device_data, callback) {
        delete devices[device_data.id];
        callback(null, true);
    }

    settings(device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
        device_data.ipAddress = newSettingsObj.ipAddress;
        device_data.zone = newSettingsObj.zone;

        try {
            changedKeysArr.forEach(function (key) {
                switch (key) {
                    case 'ipAddress':
                        Homey.log('Yamaha - IP address changed to ' + newSettingsObj.ipAddress);
                        // FIXME: check if IP is valid, otherwise return callback with an error
                        break;
                    case 'zone':
                        Homey.log('Yamaha - Zone changed to ' + newSettingsObj.zone);
                        break;
                }
            })
            callback(null, true)
        } catch (error) {
            callback(error)
        }
    }

    validateIPAddress(ipAddress, zone) {
        let client = new YamahaReceiverClient(ipAddress, zone);
        return client.getState();
    }

    getDeviceByDiscoveryResult(discoveryResult) {
        let ssdpDetailsLocation = discoveryResult.headers.location,
            device = {
                id: discoveryResult.id,
                name: 'Yamaha amplifier [' + discoveryResult.address + ']',
                data: {
                    driver: "receiver",
                },
                settings: {
                    ipAddress: discoveryResult.address,
                    zone: 'Main_Zone'
                },
            };

        return axios.get(ssdpDetailsLocation).then(data => {
            return xml2js.parseStringPromise(data.data)
                .then(result => {
                    if (typeof result.root['yamaha:X_device'] !== "undefined" && false) {
                        let xmlDevices = result.root.device,
                            xmlDevice = xmlDevices[0],
                            friendlyName = xmlDevice.friendlyName[0],
                            modelName = xmlDevice.modelName[0];

                        device.name = friendlyName + ' - ' + modelName + ' [' + discoveryResult.address + ']';

                        return device;
                    } else {
                        return null;
                    }
                });
        }).catch(this.error);
    }
}

module.exports = YamahaReceiverDriver;