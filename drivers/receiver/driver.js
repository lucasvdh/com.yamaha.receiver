'use strict';

const Homey = require('homey');
const axios = require('axios');
const xml2js = require('xml2js');
const YamahaReceiverClient = require('../../lib/YamahaReceiver/YamahaReceiverClient.js');
const Log = require('../../lib/Log/Log');

class YamahaReceiverDriver extends Homey.Driver {
    onInit(data) {
        this.log('YamahaReceiverDriver has been inited');
    }

    onPair(socket) {
        const discoveryStrategy = this.getDiscoveryStrategy();

        let defaultIP = '192.168.1.2',
            defaultZone = 'Main_Zone',
            pairingDevice = null;

        // this method is run when Homey.emit('list_devices') is run on the front-end
        // which happens when you use the template `list_devices`
        socket.on('list_devices', (data, callback) => {
            if (pairingDevice !== null) {
                callback(null, [pairingDevice]);
            } else {
                const discoveryResults = discoveryStrategy.getDiscoveryResults();

                let existingDevices = this.getDevices();

                Promise.all(Object.values(discoveryResults).map(discoveryResult => {
                    return this.getDeviceByDiscoveryResult(discoveryResult);
                })).then((devices) => {
                    devices = devices.filter(item => {
                        return item !== null && existingDevices.filter(existingDevice => {
                            return item.id === existingDevice.getData().id;
                        }).length === 0;
                    });

                    if (devices.length === 0) {
                        socket.showView('search_device');
                    } else {
                        callback(null, devices);
                    }
                }).catch(error => {
                    Log.captureException(error);
                    callback(error);
                });
            }
        });

        // this is called when the user presses save settings button in start.html
        socket.on('validate_data', (data, callback) => {
            // Continue to next view
            socket.showView('loading');

            let client = new YamahaReceiverClient(data.ipAddress);

            if (data.validate === false) {
                pairingDevice = {
                    id: data.ipAddress + '[' + data.zone + ']',
                    name: 'Yamaha amplifier [' + data.ipAddress + ']',
                    data: {
                        id: data.ipAddress + '[' + data.zone + ']',
                        driver: "receiver",
                    },
                    settings: {
                        ipAddress: data.ipAddress,
                        zone: 'Main_Zone'
                    },
                };

                socket.showView('list_devices');
            } else {
                client.getState().then(state => {
                    pairingDevice = {
                        id: data.ipAddress + '[' + data.zone + ']',
                        name: 'Yamaha amplifier [' + data.ipAddress + ']',
                        data: {
                            id: data.ipAddress + '[' + data.zone + ']',
                            driver: "receiver",
                        },
                        settings: {
                            ipAddress: data.ipAddress,
                            zone: 'Main_Zone'
                        },
                    };

                    socket.showView('list_devices');
                }).catch(error => {
                    Log.captureException(error);
                    socket.showView('search_device');
                    socket.emit('error', error);
                });
            }
        });

        // socket.on('get_device', (data, callback) => {
        //     callback(null, pairingDevice);
        // });

        socket.on('disconnect', () => {
            this.log("Yamaha receiver app - User aborted pairing, or pairing is finished");
        });
    }

    settings(device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
        device_data.ipAddress = newSettingsObj.ipAddress;
        device_data.zone = newSettingsObj.zone;

        try {
            changedKeysArr.forEach(function (key) {
                switch (key) {
                    case 'ipAddress':
                        this.log('Yamaha - IP address changed to ' + newSettingsObj.ipAddress);
                        // FIXME: check if IP is valid, otherwise return callback with an error
                        break;
                    case 'zone':
                        this.log('Yamaha - Zone changed to ' + newSettingsObj.zone);
                        break;
                }
            });
            callback(null, true)
        } catch (error) {
            Log.captureException(error);
            callback(error)
        }
    }

    validateIPAddress(ipAddress, zone) {
        let ssdpDetailsLocation = 'http://' + ipAddress + ':8080/MediaRenderer/desc.xml';

        return new Promise((resolve, reject) => {
            this.getDeviceNameFromSSDPDetailsLocation(ssdpDetailsLocation).then(name => {
                resolve(name !== false);
            }).catch(error => {
                resolve(false);
            });
        }).catch(Log.captureException);
    }

    getDeviceNameFromSSDPDetailsLocation(ssdpDetailsLocation, defaultName) {
        return new Promise((resolve, reject) => {
            axios.get(ssdpDetailsLocation).then(data => {
                xml2js.parseStringPromise(data.data)
                    .then(result => {
                        if (typeof result.root['yamaha:X_device'] !== "undefined") {
                            if (
                                typeof result.root !== "undefined"
                                && typeof result.root.device !== "undefined"
                                && typeof result.root.device[0] !== "undefined"
                                && typeof result.root.device[0].friendlyName !== "undefined"
                                && typeof result.root.device[0].friendlyName[0] !== "undefined"
                                && typeof result.root.device[0].modelName !== "undefined"
                                && typeof result.root.device[0].modelName[0] !== "undefined"
                            ) {
                                let xmlDevices = result.root.device,
                                    xmlDevice = xmlDevices[0],
                                    friendlyName = xmlDevice.friendlyName[0],
                                    modelName = xmlDevice.modelName[0];

                                resolve(friendlyName + ' - ' + modelName);
                            } else {
                                resolve(defaultName);
                            }
                        } else {
                            reject('The xml does not contain a yamaha:X_device element');
                        }
                    });
            }).catch(reject);
        });
    }

    getDeviceByDiscoveryResult(discoveryResult) {
        let ssdpDetailsLocation = discoveryResult.headers.location,
            device = {
                id: discoveryResult.id,
                name: 'Yamaha amplifier [' + discoveryResult.address + ']',
                data: {
                    id: discoveryResult.id,
                    driver: "receiver",
                },
                settings: {
                    ipAddress: discoveryResult.address,
                    zone: 'Main_Zone'
                },
            };

        return new Promise((resolve, reject) => {
            this.getDeviceNameFromSSDPDetailsLocation(ssdpDetailsLocation, device.name).then(name => {
                if (name !== false) {
                    device.name = name;
                }

                resolve(device);
            }).catch((error) => {
                Log.captureException(error);
                console.log(error);
                resolve(null);
            });
        });
    }
}

module.exports = YamahaReceiverDriver;
