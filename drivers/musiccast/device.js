"use strict";

const Homey = require('homey');
const Unicast = require('../../lib/Unicast');
const Log = require('../../lib/Log');
const YamahaExtendedControlClient = require('../../lib/YamahaExtendedControl/YamahaExtendedControlClient');
const SurroundProgramEnum = require('../../lib/YamahaExtendedControl/enums/SurroundProgramEnum');
const InputEnum = require('../../lib/YamahaExtendedControl/enums/InputEnum.js');
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
            return this.getClient().setPower(value);
        });
        this.registerCapabilityListener('volume_set', value => {
            return this.getClient().setVolume(value * this._settings.maxVolume);
        });
        this.registerCapabilityListener('volume_mute', value => {
            return this.getClient().setMuted(value);
        });
        this.registerCapabilityListener('yxc_input_selected', value => {
            return this.getClient().setInput(value);
        });
        this.registerCapabilityListener('speaker_playing', value => {
            return value
                ? this.getClient().play()
                : this.getClient().pause();
        });
        this.registerCapabilityListener('speaker_shuffle', value => {
            return this.getClient().setShuffle(value);
        });
        this.registerCapabilityListener('speaker_next', value => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            return this.getClient().next();
        });
        this.registerCapabilityListener('speaker_prev', value => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            return this.getClient().previous();
        });
        this.registerCapabilityListener('surround_program', value => {
            return this.getClient().setSurroundProgram(value);
        });
    }

    registerFlowCards() {
        this.inputChangedTrigger = new Homey.FlowCardTriggerDevice('input_changed').register();
        this.surroundProgramChangedTrigger = new Homey.FlowCardTriggerDevice('surround_program_changed').register();
        this.mutedTrigger = new Homey.FlowCardTriggerDevice('muted').register();
        this.unmutedTrigger = new Homey.FlowCardTriggerDevice('unmuted').register();

        this.changeInputAction = new Homey.FlowCardAction('change_input');
        this.changeInputAction
            .register()
            .registerRunListener((args, state) => {
                return this.getClient().setInput(args.input.id);
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
                return this.getClient().setSurroundProgram(args.surround_program.id);
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
                return this.getClient().volumeUp(args.volume);
            });

        this.volumeDownAction = new Homey.FlowCardAction('volume_down');
        this.volumeDownAction
            .register()
            .registerRunListener((args, state) => {
                return this.getClient().volumeDown(args.volume);
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
        if (typeof this._settings.zone === "undefined" || this._settings.zone === null) {
            let zone = 'main';

            this.setSettings({
                zone: zone
            });

            return zone;
        }

        return this._settings.zone;
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
     * @returns YamahaExtendedControlClient
     */
    getClient() {
        if (typeof this._yamahaExtendedControlClient === "undefined" || this._yamahaExtendedControlClient === null) {
            this._yamahaExtendedControlClient =
                new YamahaExtendedControlClient(
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
            this.setCapabilityValueSafe('onoff', state.power).catch(this.error);
        }
        if (typeof state.volume !== "undefined") {
            this.setCapabilityValueSafe('volume_set', (Math.round(state.volume / (this._settings.maxVolume / 100)) / 100)).catch(this.error);
        }
        if (typeof state.muted !== "undefined") {
            if (this.getCapabilityValue('volume_mute') !== state.muted) {
                if (state.muted) {
                    this.mutedTrigger.trigger(this).catch(this.error);
                } else {
                    this.unmutedTrigger.trigger(this).catch(this.error);
                }
            }

            this.setCapabilityValueSafe('volume_mute', state.muted).catch(this.error);
        }
        if (typeof state.input !== "undefined") {
            if (this.getCapabilityValue('yxc_input_selected') !== state.input) {
                this.inputChangedTrigger.trigger(this, {
                    input: state.input
                }).catch(this.error);
            }

            this.setCapabilityValueSafe('yxc_input_selected', state.input).catch(this.error);
        }
        // this.setCapabilityValueSafe('surround_program', state.sound_program).catch(this.error);
        // if (this.getCapabilityValue('surround_program') !== state.surround.program) {
        //     this.surroundProgramChangedTrigger.trigger(this, {
        //         surround_program: state.surround.program
        //     }).catch(this.error)
        // }
    }

    syncMusicCastPlayInfoToCapabilities(playInfo) {
        this.setCapabilityValueSafe('speaker_playing', playInfo.playing).catch(this.error);
        this.setCapabilityValueSafe('speaker_shuffle', playInfo.shuffle).catch(this.error);
        // this.setCapabilityValueSafe('speaker_repeat', playInfo.repeat).catch(this.error);
        this.setCapabilityValueSafe('speaker_artist', playInfo.artist).catch(this.error);
        this.setCapabilityValueSafe('speaker_album', playInfo.album).catch(this.error);
        this.setCapabilityValueSafe('speaker_track', playInfo.track).catch(this.error);

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

    setCapabilityValueSafe(capabilityId, value) {
        return this.setCapabilityValue(capabilityId, value).catch(error => {
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

            return error;
        })
    }

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

            if ((zoneInfo.input || null) !== null && YamahaExtendedControlClient.validateInput(zoneInfo.input)) {
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


    attributeExists(object, attribute) {
        return typeof object[attribute] !== "undefined";
    }
}

module.exports = YamahaMusicCastDevice;