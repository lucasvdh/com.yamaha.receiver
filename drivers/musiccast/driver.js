'use strict';

const Homey = require('homey');
const Log = require('../../lib/Log');
const YamahaExtendedControlClient = require('../../lib/YamahaExtendedControl/YamahaExtendedControlClient');
const axios = require('axios');
const xml2js = require('xml2js');
const {XMLMinifier} = require('../../lib/XMLMinifier')
const minifier = XMLMinifier();

class YamahaMusicCastDriver extends Homey.Driver {

    onInit() {
        this.log('YamahaMusicCastDriver has been inited');
    }

    onPair(socket) {
        const discoveryStrategy = this.getDiscoveryStrategy();

        let pairingDevice = null;

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
                });
            }
        });

        // this is called when the user presses save settings button in start.html
        socket.on('validate_data', (data, callback) => {
            // Continue to next view
            socket.showView('loading');

            let urlBase = 'http://' + data.ipAddress + ':80/',
                serviceUrl = '/YamahaExtendedControl/v1/',
                client = new YamahaExtendedControlClient(urlBase, serviceUrl, 'main');

            if (data.validate === false) {
                pairingDevice = {
                    id: data.ipAddress,
                    name: 'Yamaha MusicCast [' + data.ipAddress + ']',
                    data: {
                        id: data.ipAddress,
                        driver: "musiccast",
                    },
                    settings: {
                        urlBase: urlBase,
                        serviceUrl: serviceUrl,
                        zone: 'main',
                    },
                };

                socket.showView('list_devices');
            } else {
                client.getName().then(name => {
                    return client.getDeviceInfo().then(deviceInfo => {
                        pairingDevice = {
                            id: data.ipAddress,
                            name: name + ' - ' + deviceInfo.model_name,
                            data: {
                                id: data.ipAddress,
                                driver: "musiccast",
                            },
                            settings: {
                                urlBase: 'http://' + data.ipAddress + ':80/',
                                serviceUrl: serviceUrl,
                                zone: 'main',
                            },
                        };

                        socket.showView('list_devices');
                    })
                }).catch(error => {
                    Log.captureException(error);
                    socket.showView('search_device');
                    socket.emit('error', error);
                });
            }
        });

        socket.on('disconnect', () => {
            this.log("Yamaha MusicCast app - User aborted pairing, or pairing is finished");
        })
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
            })
            callback(null, true)
        } catch (error) {
            callback(error)
        }
    }

    /**
     * @returns YamahaExtendedControlClient
     */
    getClient(ipAddress, zone = 'main') {
        if (typeof this._yamahaExtendedControlClient === "undefined" || this._yamahaExtendedControlClient === null) {
            this._yamahaExtendedControlClient = new YamahaExtendedControlClient(ipAddress, zone);
        }

        return this._yamahaExtendedControlClient;
    }

    validateIPAddress(ipAddress, zone) {
        let client = new YamahaReceiverClient(ipAddress, zone);
        return client.getState();
    }

    getDeviceByDiscoveryResult(discoveryResult) {
        Log.addBreadcrumb(
            'ssdp',
            'Found discovery result',
            {
                discoveryResult: discoveryResult
            }
        );

        if (typeof discoveryResult.headers === "undefined"
            || discoveryResult.headers === null
            || typeof discoveryResult.headers.location === "undefined"
            || discoveryResult.headers.location === null
        ) {
            Log.captureMessage('Yamaha Receiver discovery result does not contain ssdp details location.');
        }

        let ssdpDetailsLocation = discoveryResult.headers.location,
            defaultDevice = {
                id: discoveryResult.id,
                name: 'Yamaha MusicCast [' + discoveryResult.address + ']',
                data: {
                    id: discoveryResult.id,
                    driver: "musiccast",
                },
                settings: {
                    ipAddress: discoveryResult.address,
                    zone: 'main',
                },
            };

        return new Promise((resolve, reject) => {
            this.getDeviceBySSDPDetailsLocation(ssdpDetailsLocation, defaultDevice).then(device => {
                resolve(device);
            }).catch((error) => {
                if (typeof error === "string") {
                    Log.captureMessage(error, false);
                } else {
                    Log.captureException(error, false);
                }
                resolve(null);
            });
        });
    }

    getDeviceBySSDPDetailsLocation(ssdpDetailsLocation, device) {
        return new Promise((resolve, reject) => {
            axios.get(ssdpDetailsLocation).then(data => {
                Log.addBreadcrumb(
                    'ssdp',
                    'Got SSDP XML response',
                    {
                        ssdpXML: minifier.minify(data.data)
                    }
                );

                xml2js.parseStringPromise(data.data)
                    .then(result => {
                        if (
                            typeof result.root.device === "undefined"
                            || typeof result.root.device[0].modelDescription[0] === "undefined"
                            || result.root.device[0].modelDescription[0] !== "MusicCast"
                        ) {
                            Log.addBreadcrumb(
                                'ssdp',
                                'Could not verify that this device is a MusicCast device',
                                {
                                    device: JSON.stringify(
                                        (result.root.device === "undefined")
                                            ? result.root
                                            : result.root.device
                                    )
                                },
                                Log.Severity.Warning
                            );

                            reject('Could not verify that this device is a MusicCast device');
                        } else if (typeof result.root['yamaha:X_device'] === "undefined") {
                            Log.addBreadcrumb(
                                'ssdp',
                                'yamaha:X_device not found in SSDP XML',
                                {},
                                Log.Severity.Warning
                            );

                            reject('The xml does not contain a yamaha:X_device element');
                        } else if (typeof result.root['yamaha:X_device'][0]['yamaha:X_URLBase'] === "undefined") {
                            Log.addBreadcrumb(
                                'ssdp',
                                'yamaha:X_URLBase not found in yamaha:X_device element in SSDP XML',
                                {
                                    'yamaha:X_device': JSON.stringify(result.root['yamaha:X_device'])
                                },
                                Log.Severity.Warning
                            );

                            reject('yamaha:X_URLBase not found in yamaha:X_device element in SSDP XML');
                        } else if (
                            typeof result.root['yamaha:X_device'][0]['yamaha:X_serviceList'] === "undefined"
                            || typeof result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service'] === "undefined"
                        ) {
                            Log.addBreadcrumb(
                                'ssdp',
                                'yamaha:X_serviceList not found in yamaha:X_device element in SSDP XML',
                                {
                                    'yamaha:X_device': JSON.stringify(result.root['yamaha:X_device'])
                                },
                                Log.Severity.Warning
                            );

                            reject('yamaha:X_serviceList not found in yamaha:X_device element in SSDP XML');
                        } else {
                            let serviceUrl = null;

                            device.settings.urlBase = result.root['yamaha:X_device'][0]['yamaha:X_URLBase'][0];

                            for (let i in result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service']) {
                                let service = result.root['yamaha:X_device'][0]['yamaha:X_serviceList'][0]['yamaha:X_service'][i];

                                if (
                                    typeof service['yamaha:X_specType'] !== "undefined"
                                    && typeof service['yamaha:X_specType'][0] !== "undefined"
                                    && service['yamaha:X_specType'][0] === "urn:schemas-yamaha-com:service:X_YamahaExtendedControl:1"
                                ) {
                                    Log.addBreadcrumb(
                                        'ssdp',
                                        'Found a YamahaExtendedControl service in the yamaha:X_serviceList element in SSDP XML',
                                        {
                                            specType: service['yamaha:X_specType'][0],
                                            version: service['yamaha:X_yxcVersion'][0],
                                            serviceUrl: service['yamaha:X_yxcControlURL'][0]
                                        },
                                        Log.Severity.Info
                                    );

                                    serviceUrl = service['yamaha:X_yxcControlURL'][0];
                                }
                            }

                            if (
                                typeof result.root.device !== "undefined"
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

                                device.name = friendlyName + ' - ' + modelName;
                            }

                            if (serviceUrl === null) {
                                reject('Could not find the YamahaExtendedControl service in SSDP XML');
                            } else {
                                device.settings.serviceUrl = serviceUrl;

                                Log.addBreadcrumb(
                                    'ssdp',
                                    'Got all necessary information from SSDP resolving device',
                                    {
                                        device: device
                                    },
                                    Log.Severity.Info
                                );

                                resolve(device);
                            }
                        }
                    });
            }).catch(reject);
        });
    }
}

module.exports = YamahaMusicCastDriver;