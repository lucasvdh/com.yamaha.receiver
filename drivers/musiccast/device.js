"use strict";

const Homey = require('homey');
const Log = require('../../lib/Log');
const YamahaExtendedControlClient = require('../../lib/YamahaExtendedControl/YamahaExtendedControlClient');
const SurroundProgramEnum = require('../../lib/YamahaExtendedControl/enums/SurroundProgramEnum');
const InputEnum = require('../../lib/YamahaExtendedControl/enums/InputEnum.js');
const fetch = require('node-fetch');

const CAPABILITIES_SET_DEBOUNCE = 100;
const MINIMUM_UPDATE_INTERVAL = 5000;
const UNAVAILABLE_UPDATE_INTERVAL = 60000;

class YamahaMusicCastDevice extends Homey.Device {

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
            this.deviceLog('initializing monitor');
            this.runMonitor();
            this.deviceLog('initialized');
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
            return (
                value
                    ? this.getClient().play()
                    : this.getClient().pause()
            ).then(() => {
                this.updateDevice().catch(this.error);
            });
        });
        this.registerCapabilityListener('speaker_shuffle', value => {
            return this.getClient().setShuffle(value);
        });
        this.registerCapabilityListener('speaker_next', value => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            return this.getClient().next().then(() => {
                this.updateDevice().catch(this.error);
            });
        });
        this.registerCapabilityListener('speaker_prev', value => {
            this.albumCoverImage.setUrl(null);
            this.albumCoverImage.update();
            return this.getClient().previous().then(() => {
                this.updateDevice().catch(this.error);
            });
        });
        // this.registerCapabilityListener('surround_program', value => {
        //     return this.getClient().setSurroundProgram(value);
        // });
    }

    registerFlowCards() {
        let changeInputAction = new Homey.FlowCardAction('change_input');
        changeInputAction
            .register()
            .registerRunListener((args, state) => {
                return this.getClient().setInput(args.input.id);
            });
        changeInputAction
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

        let changeSurroundProgramAction = new Homey.FlowCardAction('change_surround_program');
        changeSurroundProgramAction
            .register()
            .registerRunListener((args, state) => {
                return this.getClient().setSurroundProgram(args.surround_program.id);
            });
        changeSurroundProgramAction
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
    }

    runMonitor() {
        if (this.deleted) {
            return;
        }

        this.monitorTimeout = setTimeout(() => {
            this.updateDevice()
                .then(() => {
                    this.deviceLog('monitor updated device values');

                    this.runMonitor();
                })
                .catch(errors => {
                    if (this.getAvailable()) {
                        this.setCapabilityValue('onoff', false).catch(this.error);
                        this.setUnavailable().catch(this.error);
                    }

                    if (Array.isArray(errors)) {
                        for (let i in errors) {
                            let error = errors[i];

                            Log.captureException(error);
                        }
                    } else {
                        Log.captureException(errors);
                    }

                    this.runMonitor();
                });
        }, this.getUpdateInterval());
    }

    getUpdateInterval() {
        if (!this.getAvailable()) {
            return UNAVAILABLE_UPDATE_INTERVAL;
        }

        let updateInterval = (this._settings.updateInterval * 1000);

        if (updateInterval < MINIMUM_UPDATE_INTERVAL) {
            return MINIMUM_UPDATE_INTERVAL;
        }

        return updateInterval;
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

    updateDevice() {
        return Promise.all([
            this.getClient().getState().then(state => {
                this.syncMusicCastStateToCapabilities(state);
            }),
            this.getClient().getPlayInfo().then(playInfo => {
                this.syncMusicCastPlayInfoToCapabilities(playInfo);
            }),
        ]).then(() => {
            if (!this.getAvailable()) {
                this.setAvailable().catch(this.error);
            }
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
                new YamahaExtendedControlClient(this.getURLBase(), this.getServiceUrl(), this.getZone());
        }

        return this._yamahaExtendedControlClient;
    }

    syncMusicCastStateToCapabilities(state) {
        if (
            typeof this._settings.maxVolume === "undefined"
            || this._settings.maxVolume === null
        ) {
            this.setSettings({
                maxVolume: state.max_volume
            });
        }
        this.max_volume = state.max_volume;
        this.setCapabilityValue('onoff', state.power).catch(this.error);
        this.setCapabilityValue('volume_set', (Math.round(state.volume / (state.max_volume / 100)) / 100)).catch(this.error);
        this.setCapabilityValue('volume_mute', state.muted).catch(this.error);
        this.setCapabilityValue('yxc_input_selected', state.input).catch(this.error);
        // this.setCapabilityValue('surround_program', state.sound_program).catch(this.error);
    }

    syncMusicCastPlayInfoToCapabilities(playInfo) {
        this.setCapabilityValue('speaker_playing', playInfo.playing).catch(this.error);
        this.setCapabilityValue('speaker_shuffle', playInfo.shuffle).catch(this.error);
        // this.setCapabilityValue('speaker_repeat', playInfo.repeat).catch(this.error);
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

    onSettings(oldSettings, newSettings, changedKeys, callback) {
        this._settings = newSettings;

        callback();
    }

    onDeleted() {
        this.deleted = true;

        if (typeof this.monitorTimeout !== "undefined") {
            clearTimeout(this.monitorTimeout)
        }
    }
}

module.exports = YamahaMusicCastDevice;