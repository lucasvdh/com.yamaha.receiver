"use strict";

const Homey = require('homey');
const YamahaReceiverClient = require('../../lib/YamahaReceiverClient.js');
const SurroundProgramEnum = require('../../lib/enums/SurroundProgramEnum.js');
const InputEnum = require('../../lib/enums/InputEnum.js');

const CAPABILITIES_SET_DEBOUNCE = 100;
const MINIMUM_UPDATE_INTERVAL = 5000;
const UNAVAILABLE_UPDATE_INTERVAL = 60000;

class YamahaReceiverDevice extends Homey.Device {

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
                return this.getClient().setInput(args.input);
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
                return this.getClient().setSurroundProgram(args.surround_program);
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
                .catch(() => {
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
            this.syncReceiverStateToCapabilities(receiverStatus);
        }).catch(error => {
            this.deviceLog('monitor failed updating device values', error);
        }).then(() => {
            this.deviceLog('monitor updated device values');
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
        this.log('Yamaha Device [' + this._data.id + ']', ...message);
    }

    /**
     * @returns YamahaReceiverClient
     */
    getClient() {
        if (typeof this._yamahaReceiverClient === "undefined" || this._yamahaReceiverClient === null) {
            this._yamahaReceiverClient = new YamahaReceiverClient(this.getIPAddress(), this.getZone());
            this._yamahaReceiverClient.onSuccess(this.onClientSuccess);
            this._yamahaReceiverClient.onError(this.onClientError);
        }

        return this._yamahaReceiverClient;
    }

    syncReceiverStateToCapabilities(state) {
        this.setCapabilityValue('onoff', state.power).catch(this.error);
        this.setCapabilityValue('volume_set', state.volume.current / 100).catch(this.error);
        this.setCapabilityValue('volume_mute', state.volume.muted).catch(this.error);
        this.setCapabilityValue('input_selected', state.input.selected).catch(this.error);
        this.setCapabilityValue('surround_program', state.surround.program).catch(this.error);
        this.setCapabilityValue('surround_straight', state.surround.straight).catch(this.error);
        this.setCapabilityValue('surround_enhancer', state.surround.straight).catch(this.error);
        this.setCapabilityValue('sound_direct', state.surround.straight).catch(this.error);
        this.setCapabilityValue('sound_extra_bass', state.surround.straight).catch(this.error);
        this.setCapabilityValue('sound_adaptive_drc', state.surround.straight).catch(this.error);
    }
}

module.exports = YamahaReceiverDevice;