'use strict';

const Homey = require('homey');
const YamahaExtendedControlClient = require('../../lib/YamahaExtendedControl/YamahaExtendedControlClient.js');

class YamahaMusicCastDriver extends Homey.Driver {

    onInit() {
        this.log('YamahaMusicCastDriver has been inited');
    }

    onPair(socket) {
        let defaultIP = '192.168.1.2',
            defaultZone = 'main',
            pairingDevice = {
                name: 'Yamaha MusicCast',
                data: {
                    driver: "musiccast",
                    ipAddress: defaultIP,
                    zone: defaultZone
                },
                settings: {
                    ipAddress: defaultIP,
                },
            };

        // this is called when the user presses save settings button in start.html
        socket.on('get_devices', function (data, callback) {
            // Set passed pair settings in variables
            pairingDevice.data.ipAddress = data.ipAddress;
            pairingDevice.settings.ipAddress = data.ipAddress;

            // assume IP is OK and continue
            socket.emit('continue', null);
        });


        socket.on('list_devices', (data, callback) => {
            this.log("Yamaha MusicCast app - list_devices from ip " + pairingDevice.data.ipAddress);

            this.getClient(pairingDevice.data.ipAddress).getDeviceInfo().then(deviceInfo => {
                this.getClient(pairingDevice.data.ipAddress).getName().then(name => {
                    this.getClient(pairingDevice.data.ipAddress).getFeatures().then(features => {
                        pairingDevice.name = name.text + ': ' + device.model_name;
                        pairingDevice.data.id = deviceInfo.device_id;
                        pairingDevice.data.name = name.text + ': ' + device.model_name;

                        callback(null, [pairingDevice]);
                    });
                });
            }).catch(callback);
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
}

module.exports = YamahaMusicCastDriver;