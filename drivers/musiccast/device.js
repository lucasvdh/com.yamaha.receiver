"use strict";

const Homey = require('homey');
const YamahaExtendedControlClient = require('../../lib/YamahaExtendedControl/YamahaExtendedControlClient.js');
const SurroundProgramEnum = require('../../lib/YamahaExtendedControl/enums/SurroundProgramEnum.js');
const InputEnum = require('../../lib/YamahaExtendedControl/enums/InputEnum.js');

const CAPABILITIES_SET_DEBOUNCE = 100;
const MINIMUM_UPDATE_INTERVAL = 5000;
const UNAVAILABLE_UPDATE_INTERVAL = 60000;

class YamahaMusicCastDevice extends Homey.Device {

    onInit() {
        this._data = this.getData();
        this._settings = this.getSettings();

        this.deviceLog('registering listeners');
        this.registerListeners();

        this.deviceLog('registering flow card conditions');
        this.registerFlowCards();

        this.ready(() => {
            this.deviceLog('initializing monitor');
            this.runMonitor();
            this.deviceLog('initialized');
        });
    }

    registerListeners() {
        this._onCapabilitiesSet = this._onCapabilitiesSet.bind(this);

        this.registerCapabilityListener('onoff', value => {
            return this.getClient().setPower(value);
        });
        this.registerCapabilityListener('volume_set', value => {
            return this.getClient().setVolume(value * 100);
        });
        this.registerCapabilityListener('volume_mute', value => {
            return this.getClient().setMuted(value);
        });
        this.registerCapabilityListener('input_selected', value => {
            return this.getClient().setInput(value);
        });
        this.registerCapabilityListener('surround_program', value => {
            return this.getClient().setSurroundProgram(value);
        });
        this.registerCapabilityListener('surround_straight', value => {
            return this.getClient().setSurroundStraight(value);
        });
        this.registerCapabilityListener('surround_enhancer', value => {
            return this.getClient().setSurroundEnhancer(value);
        });
        this.registerCapabilityListener('sound_direct', value => {
            return this.getClient().setSoundDirect(value);
        });
        this.registerCapabilityListener('sound_extra_bass', value => {
            return this.getClient().setSoundExtraBass(value);
        });
        this.registerCapabilityListener('sound_adaptive_drc', value => {
            return this.getClient().setSoundAdaptiveDRC(value);
        });
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
        setTimeout(() => {
            this.updateDevice()
                .then(() => {
                    this.runMonitor();
                })
                .catch(error => {
                    console.log(error);

                    if (error.code !== 'EHOSTUNREACH') {
                        throw error;
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
        return this._settings.ipAddress;
    }

    getZone() {
        return this._settings.zone;
    }

    updateDevice(resolve, reject) {
        return this.getClient().getState().then((receiverStatus) => {
            this.syncMusicCastStateToCapabilities(receiverStatus);
        }).catch(error => {
            this.deviceLog('monitor failed updating device values');

            if (this.getAvailable()) {
                this.setCapabilityValue('onoff', false).catch(this.error);
                this.setUnavailable().catch(this.error);
            }

            if (error.code !== 'EHOSTUNREACH') {
                throw error;
            }
        });;
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
            this._yamahaExtendedControlClient = new YamahaExtendedControlClient(this.getIPAddress(), this.getZone());
        }

        return this._yamahaExtendedControlClient;
    }

    syncMusicCastStateToCapabilities(state) {
        this.setCapabilityValue('onoff', state.power).catch(this.error);
        this.setCapabilityValue('volume_set', state.volume).catch(this.error);
        this.setCapabilityValue('volume_mute', state.muted).catch(this.error);
        this.setCapabilityValue('input_selected', state.input).catch(this.error);
        this.setCapabilityValue('surround_program', state.sound_program).catch(this.error);
    }
}

module.exports = YamahaMusicCastDevice;