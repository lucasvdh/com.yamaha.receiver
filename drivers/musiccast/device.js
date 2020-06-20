"use strict";

const Homey = require('homey');
const Unicast = require('../../lib/Unicast');
const Log = require('../../lib/Log');
const YamahaReceiverControl = require('../../lib/YamahaExtendedControl');
const SurroundProgramEnum = require('../../lib/YamahaExtendedControl/Enums/SurroundProgramEnum');
const InputEnum = require('../../lib/YamahaExtendedControl/Enums/InputEnum.js');
const fetch = require('node-fetch');

const CAPABILITIES_SET_DEBOUNCE = 100;
const MINIMUM_UPDATE_INTERVAL = 8 * 60 * 1000;
const UNAVAILABLE_UPDATE_INTERVAL = 60000;

class YamahaMusicCastDevice extends Unicast.Device {

    onInit() {
        this.deleted = false;
        this._data = this.getData();
        this._settings = this.getSettings();

        this.fixCapabilities();

        this.deviceLog('registering listeners');
        this.registerListeners();

        this.deviceLog('registering flow card conditions');
        this.registerFlowCards();

        this.setAvailable().catch(this.error);

        this.albumCoverImageUrl = null;
        this.albumCoverImage = new Homey.Image('jpg');
        this.albumCoverImage.setUrl(null);
        this.albumCoverImage.register()
            .then(() => {
                return this.setAlbumArtImage(this.albumCoverImage);
            })
            .catch(this.error);

        Log.setTags({
            name: this.getName(),
        });

        if (typeof this._data.id !== "undefined") {
            Log.setTags({
                id: this._data.id,
            });
        }

        this.ready(() => {
            this.syncNetworkId().then(() => {
                this.deviceLog('network id synced');
            }).catch(error => {
                this.deviceLog('network id could not bne synced');
                Log.captureException(error);
            });

            this.deviceLog('initializing heartbeat monitor');
            this.heartbeat();

            this.deviceLog('device initialized');
        });
    }

    fixCapabilities() {
        let deprecatedCapabilities = [
                'source_selected',
                'soundprogram_selected'
            ],
            newCapabilities = [
                'musiccast_zone',
                'yxc_input_selected',
                'speaker_playing',
                'speaker_shuffle',
                'speaker_artist',
                'speaker_album',
                'speaker_track',
                'speaker_next',
                'speaker_prev'
            ];

        for (let i in deprecatedCapabilities) {
            let deprecatedCapability = deprecatedCapabilities[i];

            if (this.hasCapability(deprecatedCapability)) {
                this.removeCapability(deprecatedCapability);
            }
        }

        for (let i in newCapabilities) {
            let newCapability = newCapabilities[i];

            if (!this.hasCapability(newCapability)) {
                this.addCapability(newCapability);
            }
        }
    }

    getNetworkId() {
        return this._settings.networkId || null;
    }

    syncNetworkId() {
        return new Promise((resolve, reject) => {
            if (this.getNetworkId() === null) {
                this.getClient().getDeviceInfo().then(device => {
                    this._settings.networkId = device.device_id;

                    return this.setSettings({
                        networkId: device.device_id
                    }).then(resolve);
                }).catch(reject);
            } else {
                resolve();
            }
        });
    }

    registerListeners() {
        this._onCapabilitiesSet = this._onCapabilitiesSet.bind(this);

        this.registerCapabilityListener('onoff', value => {
            return this.setPower(value);
        });
        this.registerCapabilityListener('volume_set', value => {
            return this.setVolume(value * this._settings.maxVolume);
        });
        this.registerCapabilityListener('volume_mute', value => {
            return this.setMuted(value);
        });
        this.registerCapabilityListener('yxc_input_selected', value => {
            return this.setInput(value);
        });
        this.registerCapabilityListener('musiccast_zone', zone => {
            return this.setZone(zone);
        });
        this.registerCapabilityListener('speaker_playing', value => {
            return this.setPlaying(value);
        });
        this.registerCapabilityListener('speaker_shuffle', value => {
            return this.setShuffle(value);
        });
        this.registerCapabilityListener('speaker_next', value => {
            return this.next();
        });
        this.registerCapabilityListener('speaker_prev', value => {
            return this.previous();
        });
        this.registerCapabilityListener('surround_program', value => {
            return this.setSurroundProgram(value);
        });
    }

    registerFlowCards() {
        this.inputChangedTrigger = new Homey.FlowCardTriggerDevice('input_changed').register();
        this.surroundProgramChangedTrigger = new Homey.FlowCardTriggerDevice('surround_program_changed').register();
        this.mutedTrigger = new Homey.FlowCardTriggerDevice('muted').register();
        this.unmutedTrigger = new Homey.FlowCardTriggerDevice('unmuted').register();

        this.changeZoneAction = new Homey.FlowCardAction('change_zone');
        this.changeZoneAction
            .register()
            .registerRunListener((args, state) => {
                return new Promise(((resolve, reject) => {
                    this.setZone(args.zone).then(resolve).catch(error => {
                        Log.captureException(error);
                        reject(error);
                    })
                }));
            });

        this.changeInputAction = new Homey.FlowCardAction('change_input');
        this.changeInputAction
            .register()
            .registerRunListener((args, state) => {
                return new Promise(((resolve, reject) => {
                    this.setInput(args.input.id).then(resolve).catch(error => {
                        Log.captureException(error);
                        reject(error);
                    })
                }));
            });
        this.changeInputAction
            .getArgument('input')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    Object.values(InputEnum).map(value => {
                        return {
                            id: value,
                            name: value
                        };
                    })
                );
            });

        this.changeSurroundProgramAction = new Homey.FlowCardAction('change_surround_program');
        this.changeSurroundProgramAction
            .register()
            .registerRunListener((args, state) => {
                return new Promise(((resolve, reject) => {
                    this.setSurroundProgram(args.surround_program.id).then(resolve).catch(error => {
                        Log.captureException(error);
                        reject(error);
                    })
                }));
            });
        this.changeSurroundProgramAction
            .getArgument('surround_program')
            .registerAutocompleteListener((query, args) => {
                return Promise.resolve(
                    Object.values(SurroundProgramEnum).map(value => {
                        return {
                            id: value,
                            name: value
                        };
                    })
                );
            });

        this.volumeUpAction = new Homey.FlowCardAction('volume_up');
        this.volumeUpAction
            .register()
            .registerRunListener((args, state) => {
                return new Promise(((resolve, reject) => {
                    this.getClient().volumeUp(args.volume).then(resolve).catch(error => {
                        Log.captureException(error);
                        reject(error);
                    })
                }));
            });

        this.volumeDownAction = new Homey.FlowCardAction('volume_down');
        this.volumeDownAction
            .register()
            .registerRunListener((args, state) => {
                return new Promise(((resolve, reject) => {
                    this.getClient().volumeDown(args.volume).then(resolve).catch(error => {
                        Log.captureException(error);
                        reject(error);
                    })
                }));
            });
    }

    heartbeat() {
        if (this.deleted) {
            return;
        } else if (typeof this.heartbeatTimeout !== "undefined") {
            clearTimeout(this.heartbeatTimeout)
        }

        this.heartbeatTimeout = setTimeout(() => {
            this.updateDeviceStatus()
                .then(() => {
                    this.deviceLog('heartbeat updated device values');
                    this.heartbeat();
                })
                .catch(error => {
                    if (this.getAvailable()) {
                        this.setCapabilityValue('onoff', false).catch(this.error);
                        this.setUnavailable().catch(this.error);
                    }

                    if (
                        typeof error.code === "undefined"
                        || (
                            error.code !== 'EHOSTUNREACH'
                            && error.code !== 'ECONNREFUSED'
                            && error.code !== 'ECONNRESET'
                            && error.code !== 'ETIMEDOUT'
                        )
                    ) {
                        Log.captureException(error);
                    }

                    this.heartbeat();
                });
        }, this.getHeartbeatInterval());
    }

    getHeartbeatInterval() {
        if (!this.getAvailable()) {
            return UNAVAILABLE_UPDATE_INTERVAL;
        }

        return MINIMUM_UPDATE_INTERVAL;
    }

    getIPAddress() {
        if (typeof this._settings.ipaddress !== "undefined" && this._settings.ipaddress !== null) {
            return this._settings.ipaddress;
        }

        if (typeof this._data.ipaddress !== "undefined" && this._data.ipaddress !== null) {
            return this._data.ipaddress;
        }

        if (typeof this._settings.ipAddress !== "undefined" && this._settings.ipAddress !== null) {
            return this._settings.ipAddress;
        }

        throw new Error('IP address (old and new) could not be found in device');
    }

    getURLBase() {
        if ((typeof this._settings.urlBase === "undefined" || this._settings.urlBase === null)
            && typeof this.getIPAddress() !== "undefined" && this.getIPAddress() !== null) {
            let urlBase = 'http://' + this.getIPAddress() + '/';

            this.setSettings({
                urlBase: urlBase
            });

            return urlBase;
        }

        return this._settings.urlBase;
    }

    getServiceUrl() {
        if (typeof this._settings.serviceUrl === "undefined" || this._settings.serviceUrl === null) {
            let serviceUrl = '/YamahaExtendedControl/v1/';

            this.setSettings({
                serviceUrl: serviceUrl
            });

            return serviceUrl;
        }

        return this._settings.serviceUrl;
    }

    getZone() {
        return this.getCapabilityValue('musiccast_zone') || 'main';
    }

    updateDeviceStatus() {
        return this.getClient().getState().then(state => {
            this.syncMusicCastStateToCapabilities(state);
        }).then(() => {
            if (!this.getAvailable()) {
                this.setAvailable().catch(this.error);
            }

            this.heartbeat();
        });
    }

    updateDevicePlayInfo() {
        return this.getClient().getPlayInfo().then(playInfo => {
            this.syncMusicCastPlayInfoToCapabilities(playInfo);
        }).then(() => {
            if (!this.getAvailable()) {
                this.setAvailable().catch(this.error);
            }

            this.heartbeat();
        });
    }

    _onCapabilitiesSet(valueObj, optsObj) {
        console.log(valueObj, optsObj);

        return true;
    }

    onClientSuccess(error) {
        // We got a success so the device is available, check if we need to re-enable it
        if (!this.getAvailable()) {
            this.setAvailable();
        }
    }

    onClientError(error) {
        // We got an error so the device is unavailable, check if we need to disable it
        if (this.getAvailable()) {
            this.setUnavailable();
            this.setCapabilityValue('onoff', false).catch(this.error);
        }
        this.error(error)
    }

    deviceLog(...message) {
        this.log('Yamaha MusicCast Device [' + this._data.id + ']', ...message);
    }

    /**
     * @returns YamahaExtendedControl.Client
     */
    getClient() {
        if (typeof this._yamahaExtendedControlClient === "undefined" || this._yamahaExtendedControlClient === null) {
            this._yamahaExtendedControlClient =
                new YamahaReceiverControl.Client(
                    this.getURLBase(),
                    this.getServiceUrl(),
                    this.getZone(),
                    this.getUnicastName(),
                    this.getUnicastPort()
                );
        }

        return this._yamahaExtendedControlClient;
    }

    syncMusicCastStateToCapabilities(state) {
        if (
            (
                typeof this._settings.maxVolume === "undefined"
                || this._settings.maxVolume === null
            ) && (state.max_volume || null) !== null
        ) {
            this._settings.maxVolume = state.max_volume;
            this.setSettings({
                maxVolume: state.max_volume
            });
        }

        if (typeof state.power !== "undefined") {
            this.setCapabilityValue('onoff', state.power).catch(this.error);
        }
        if (typeof state.volume !== "undefined") {
            this.setCapabilityValue('volume_set', (Math.round(state.volume / (this._settings.maxVolume / 100)) / 100)).catch(this.error);
        }
        if (typeof state.muted !== "undefined") {
            if (this.getCapabilityValue('volume_mute') !== state.muted) {
                if (state.muted) {
                    this.triggerFlowCard(this.mutedTrigger).catch(this.error);
                } else {
                    this.triggerFlowCard(this.unmutedTrigger).catch(this.error);
                }
            }

            this.setCapabilityValue('volume_mute', state.muted).catch(this.error);
        }
        if (typeof state.input !== "undefined") {
            if (this.getCapabilityValue('yxc_input_selected') !== state.input) {
                this.triggerFlowCard(this.inputChangedTrigger, {
                    input: state.input
                }).catch(this.error);
            }

            this.setCapabilityValue('yxc_input_selected', state.input).catch(this.error);
        }
        // this.setCapabilityValueSafe('surround_program', state.sound_program).catch(this.error);
        // if (this.getCapabilityValue('surround_program') !== state.surround.program) {
        //     this.triggerFlowCard(this.surroundProgramChangedTrigger, {
        //         surround_program: state.surround.program
        //     }).catch(this.error)
        // }
    }

    syncMusicCastPlayInfoToCapabilities(playInfo) {
        this.setCapabilityValue('speaker_playing', playInfo.playing).catch(this.error);
        this.setCapabilityValue('speaker_shuffle', playInfo.shuffle).catch(this.error);
        // this.setCapabilityValueSafe('speaker_repeat', playInfo.repeat).catch(this.error);
        this.setCapabilityValue('speaker_artist', playInfo.artist).catch(this.error);
        this.setCapabilityValue('speaker_album', playInfo.album).catch(this.error);
        this.setCapabilityValue('speaker_track', playInfo.track).catch(this.error);

        // Check if the image needs to be updated
        if (this.albumCoverImageUrl !== playInfo.albumart_url) {
            this.albumCoverImage.setStream(async (stream) => {
                const res = await fetch(playInfo.albumart_url);
                if (!res.ok)
                    throw new Error('Invalid Response');

                return res.body.pipe(stream);
            });
            this.albumCoverImage.update();
            this.albumCoverImageUrl = playInfo.albumart_url;
        }
        // this.setCapabilityValue('surround_program', state.sound_program).catch(this.error);
    }

    setCapabilityValue(capabilityId, value) {
        return new Promise((resolve, reject) => {
            super.setCapabilityValue(capabilityId, value).then(resolve).catch(error => {
                Log.addBreadcrumb(
                    'musiccast_device',
                    'Could not set capability value',
                    {
                        capabilityId: capabilityId,
                        value: value
                    },
                    Log.Severity.Error
                );
                Log.captureException(error);

                reject(error);
            })
        });
    }

    triggerFlowCard(flowCardObject, args = {}) {
        return new Promise((resolve, reject) => {
            flowCardObject.trigger(this, args).then(resolve).catch(error => {
                Log.addBreadcrumb(
                    'musiccast_device',
                    'Could not trigger flow card ' + flowCardObject.type,
                    {
                        flowCardActionId: flowCardObject.id,
                        args: args
                    },
                    Log.Severity.Error
                );
                Log.captureException(error);

                reject(error);
            });
        })
    };

    onSettings(oldSettings, newSettings, changedKeys, callback) {
        this._settings = newSettings;

        callback();
    }

    onDeleted() {
        this.deleted = true;

        if (typeof this.heartbeatTimeout !== "undefined") {
            clearTimeout(this.heartbeatTimeout)
        }
    }

    onUnicastEvent(event, remote) {
        this.deviceLog("Received Unicast event from", remote.address);

        let statusUpdated = false,
            playInfoUpdated = false,
            signalInfoUpdated = false,
            presetInfoUpdated = false,
            distInfoUpdated = false,
            settingsUpdated = false;

        if (event.hasSystemInfo()) {
            // TODO: systemInfo.bluetooth_info_updated /system/getBluetoothInfo
            // TODO: systemInfo.func_status_updated /system/getFuncStatus
            // TODO: systemInfo.func_status_updated /system/getFuncStatus
            // TODO: systemInfo.name_text_updated /system/getNameText
            // TODO: systemInfo.location_info_updated /system/getLocationInfo
        }

        if (event.hasZoneInfo()) {
            let zoneInfo = event.getZoneInfo();

            if ((zoneInfo.power || null) !== null) {
                this.syncMusicCastStateToCapabilities({
                    power: zoneInfo.power === "on"
                })
            }

            if ((zoneInfo.input || null) !== null && this.getClient().validateInput(zoneInfo.input)) {
                this.syncMusicCastStateToCapabilities({
                    input: zoneInfo.input
                })
            }

            if ((zoneInfo.volume || null) !== null) {
                this.syncMusicCastStateToCapabilities({
                    volume: zoneInfo.volume
                })
            }

            if ((zoneInfo.mute || null) !== null) {
                this.syncMusicCastStateToCapabilities({
                    muted: zoneInfo.mute
                })
            }

            if ((zoneInfo.status_updated || null) !== null && zoneInfo.status_updated) {
                statusUpdated = true;
            }
            if ((zoneInfo.signal_info_updated || null) !== null && zoneInfo.signal_info_updated) {
                signalInfoUpdated = true;
            }
        }

        if (event.hasTunerInfo()) {
            let tunerInfo = event.getTunerInfo();

            if ((tunerInfo.play_info_updated || null) !== null && tunerInfo.play_info_updated) {
                playInfoUpdated = true;
            }

            if ((tunerInfo.preset_info_updated || null) !== null && tunerInfo.preset_info_updated) {
                presetInfoUpdated = true;
            }
        }

        if (event.hasNetUSBInfo()) {
            let netUSBInfo = event.getNetUSBInfo();

            if ((netUSBInfo.play_info_updated || null) !== null && netUSBInfo.play_info_updated) {
                playInfoUpdated = true;
            }

            if ((netUSBInfo.preset_info_updated || null) !== null && netUSBInfo.preset_info_updated) {
                presetInfoUpdated = true;
            }
        }

        if (event.hasCDInfo()) {
            let cdInfo = event.getCDInfo();

            if ((cdInfo.play_info_updated || null) !== null && cdInfo.play_info_updated) {
                playInfoUpdated = true;
            }
        }

        if (event.hasDistInfo()) {
            let distInfo = event.getDistInfo();

            if ((distInfo.dist_info_updated || null) !== null && distInfo.dist_info_updated) {
                distInfoUpdated = true;
            }
        }

        if (event.hasClockInfo()) {
            let clockInfo = event.getClockInfo();

            if ((clockInfo.settings_updated || null) !== null && clockInfo.settings_updated) {
                settingsUpdated = true;
            }
        }

        if (statusUpdated) {
            this.updateDeviceStatus().catch(error => {
                this.deviceLog('could not update device status by unicast event');

                return this.error(error);
            });
        }
        if (playInfoUpdated) {
            this.updateDevicePlayInfo().catch(error => {
                this.deviceLog('could not update device play info by unicast event');

                return this.error(error);
            });
        }
        if (signalInfoUpdated) {
            // TODO this.updateDeviceSignalInfo()
        }
        if (presetInfoUpdated) {
            // TODO this.updateDevicePresetInfo()
        }
        if (distInfoUpdated) {
            // TODO this.updateDeviceDistInfo()
        }
        if (settingsUpdated) {
            // TODO this.updateDeviceSettings()
        }
    }

    setPower(power) {
        return new Promise((resolve, reject) => {
            this.getClient().setPower(power).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setVolume(volume) {
        return new Promise((resolve, reject) => {
            this.getClient().setVolume(volume).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setMuted(muted) {
        return new Promise((resolve, reject) => {
            this.getClient().setMuted(muted).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setInput(input) {
        return new Promise((resolve, reject) => {
            this.getClient().setInput(input).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.InvalidParameter) {
                    reject(new Error(Homey.__('error.invalidInput', {input: input})));
                } else if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setZone(zone) {
        return new Promise((resolve, reject) => {
            this.getClient().setZone(zone).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.InvalidZone) {
                    reject(new Error(Homey.__('error.invalidZone', {zone: zone})));
                } else if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setPlaying(playing) {
        return new Promise((resolve, reject) => {
            if (this.getCapabilityValue('onoff') === false) {
                this.setPower(true).then(() => {
                    (playing ? this.getClient().play() : this.getClient().pause()).then(resolve).catch(error => {
                        if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                            reject(new Error(Homey.__('error.uncontrollable')));
                        } else {
                            reject(new Error(Homey.__('error.generic')));
                        }
                    });
                }).catch(reject);
            } else {
                (playing ? this.getClient().play() : this.getClient().pause()).then(resolve).catch(error => {
                    if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                        reject(new Error(Homey.__('error.uncontrollable')));
                    } else {
                        reject(new Error(Homey.__('error.generic')));
                    }
                });
            }
        });
    }

    setShuffle(shuffle) {
        return new Promise((resolve, reject) => {
            this.getClient().setShuffle(shuffle).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    next() {
        return new Promise((resolve, reject) => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            this.getClient().next().then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    previous() {
        return new Promise((resolve, reject) => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            this.getClient().previous().then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }

    setSurroundProgram(surroundProgram) {
        return new Promise((resolve, reject) => {
            this.getClient().setSurroundProgram(surroundProgram).then(resolve).catch(error => {
                if (error instanceof YamahaReceiverControl.Errors.InvalidParameter) {
                    reject(new Error(Homey.__('error.invalidSurroundProgram', {program: surroundProgram})));
                } else if (error instanceof YamahaReceiverControl.Errors.GuardedError) {
                    reject(new Error(Homey.__('error.uncontrollable')));
                } else {
                    reject(new Error(Homey.__('error.generic')));
                }
            });
        });
    }
}

module.exports = YamahaMusicCastDevice;