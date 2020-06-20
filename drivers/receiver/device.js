"use strict";

const Homey = require('homey');
const Log = require('../../lib/Log');
const YamahaReceiverClient = require('../../lib/YamahaReceiver/YamahaReceiverClient');
const SurroundProgramEnum = require('../../lib/YamahaReceiver/Enums/SurroundProgramEnum');
const InputEnum = require('../../lib/YamahaReceiver/Enums/InputEnum');

const CAPABILITIES_SET_DEBOUNCE = 100;
const MINIMUM_UPDATE_INTERVAL = 5000;
const UNAVAILABLE_UPDATE_INTERVAL = 60000;

class YamahaReceiverDevice extends Homey.Device {

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
                'input_selected',
                'surround_program',
                'surround_straight',
                'surround_enhancer',
                'sound_direct',
                'sound_extra_bass',
                'sound_adaptive_drc',
                'media_previous',
                'media_next',
                'media_play',
                'media_pause'
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
            return this.getClient().setPower(value).catch(this.error);
        });
        this.registerCapabilityListener('volume_set', value => {
            return this.getClient().setVolume(value * 100).catch(this.error);
        });
        this.registerCapabilityListener('volume_mute', value => {
            return this.getClient().setMuted(value).then(() => {
                if (value) {
                    this.mutedTrigger.trigger(this).catch(this.error);
                } else {
                    this.unmutedTrigger.trigger(this).catch(this.error);
                }
            }).catch(this.error);
        });
        this.registerCapabilityListener('input_selected', value => {
            return this.getClient().setInput(value).then(() => {
                return this.inputChangedTrigger.trigger(this, {
                    input: value
                }).catch(this.error);
            }).catch(this.error);
        });
        this.registerCapabilityListener('surround_program', value => {
            return this.getClient().setSurroundProgram(value).then(() => {
                this.surroundProgramChangedTrigger.trigger(this, {
                    surround_program: value
                }).then(this.log).catch(this.error)
            }).catch(this.error);
        })
        this.registerCapabilityListener('surround_straight', value => {
            return this.getClient().setSurroundStraight(value).catch(this.error);
        });
        this.registerCapabilityListener('surround_enhancer', value => {
            return this.getClient().setSurroundEnhancer(value).catch(this.error);
        });
        this.registerCapabilityListener('sound_direct', value => {
            return this.getClient().setSoundDirect(value).catch(this.error);
        });
        this.registerCapabilityListener('sound_extra_bass', value => {
            return this.getClient().setSoundExtraBass(value).catch(this.error);
        });
        this.registerCapabilityListener('sound_adaptive_drc', value => {
            return this.getClient().setSoundAdaptiveDRC(value).catch(this.error);
        });
        // this.registerCapabilityListener('speaker_playing', value => {
        //     return value
        //         ? this.getClient().play().catch(this.error)
        //         : this.getClient().pause().catch(this.error);
        // });
        // this.registerCapabilityListener('speaker_next', value => {
        //     return this.getClient().next().then(() => {
        //         return this.updateDevice();
        //     }).catch(this.error);
        // });
        // this.registerCapabilityListener('speaker_prev', value => {
        //     return this.getClient().previous().then(() => {
        //         return this.updateDevice();
        //     }).catch(this.error);
        // });
        this.registerCapabilityListener('media_previous', value => {
            return this.getClient().previous().catch(this.error);
        });
        this.registerCapabilityListener('media_next', value => {
            return this.getClient().next().catch(this.error);
        });
        this.registerCapabilityListener('media_play', value => {
            return this.getClient().play().catch(this.error);
        });
        this.registerCapabilityListener('media_pause', value => {
            return this.getClient().pause().catch(this.error);
        });
    }

    registerFlowCards() {
        this.inputChangedTrigger = new Homey.FlowCardTriggerDevice('input_changed').register();
        this.surroundProgramChangedTrigger = new Homey.FlowCardTriggerDevice('surround_program_changed').register();
        this.mutedTrigger = new Homey.FlowCardTriggerDevice('muted').register();
        this.unmutedTrigger = new Homey.FlowCardTriggerDevice('unmuted').register();

        this.changeInputAction = new Homey.FlowCardAction('change_input').register();
        this.changeInputAction
            .registerRunListener((args, state) => {
                return this.getClient().setInput(args.input.id).then(() => {
                    return this.inputChangedTrigger.trigger(this, {
                        input: args.input.id
                    });
                }).catch(this.error);
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

        this.changeSurroundProgramAction = new Homey.FlowCardAction('change_surround_program').register();
        this.changeSurroundProgramAction
            .registerRunListener((args, state) => {
                return this.getClient().setSurroundProgram(args.surround_program.id).then(() => {
                    return this.surroundProgramChangedTrigger.trigger(this, {
                        surround_program: args.surround_program.id
                    });
                }).catch(this.error);
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

        this.mediaPreviousAction = new Homey.FlowCardAction('media_previous').register();
        this.mediaPreviousAction
            .registerRunListener((args, state) => {
                return this.getClient().previous().catch(this.error);
            });
        this.mediaNextAction = new Homey.FlowCardAction('media_next').register();
        this.mediaNextAction
            .registerRunListener((args, state) => {
                return this.getClient().next().catch(this.error);
            });
        this.mediaPlayAction = new Homey.FlowCardAction('media_play').register();
        this.mediaPlayAction
            .registerRunListener((args, state) => {
                return this.getClient().play().catch(this.error);
            });
        this.mediaPauseAction = new Homey.FlowCardAction('media_pause').register();
        this.mediaPauseAction
            .registerRunListener((args, state) => {
                return this.getClient().pause().catch(this.error);
            });
    }

    runMonitor() {
        if (this.deleted) {
            return;
        }

        this.monitorTimeout = setTimeout(() => {
            this.updateDevice()
                .then(() => {
                    this.runMonitor();
                })
                .catch(errors => {
                    this.deviceLog('monitor failed updating device values');

                    if (this.getAvailable()) {
                        this.setCapabilityValue('onoff', false).catch(this.error);
                        this.setUnavailable().catch(this.error);
                    }

                    if (Array.isArray(errors)) {
                        for (let i in errors) {
                            let error = errors[i];

                            if (
                                typeof error.code === "undefined"
                                || (
                                    error.code !== 'EHOSTUNREACH'
                                    && error.code !== 'ECONNREFUSED'
                                    && error.code !== 'ECONNRESET'
                                    && error.code !== 'ETIMEDOUT'
                                    && error.code !== 'ENOTFOUND' // dns not resolvable
                                    && error.code !== 'ENETUNREACH' // there's no internet
                                )
                            ) {
                                Log.captureException(error);
                            }
                        }
                    } else if (
                        typeof errors.code === "undefined"
                        || (
                            errors.code !== 'EHOSTUNREACH'
                            && errors.code !== 'ECONNREFUSED'
                            && errors.code !== 'ECONNRESET'
                            && errors.code !== 'ETIMEDOUT'
                            && errors.code !== 'ENOTFOUND' // dns not resolvable
                            && errors.code !== 'ENETUNREACH' // there's no internet
                        )
                    ) {
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

    getControlURL() {
        if (typeof this._settings.controlURL === "undefined" || this._settings.controlURL === null) {
            let controlURL = '/YamahaRemoteControl/ctrl';

            this.setSettings({
                controlURL: controlURL
            });

            return controlURL;
        }

        return this._settings.controlURL;
    }

    updateDevice() {
        return this.getClient().getState().then((receiverState) => {
            this.syncReceiverStateToCapabilities(receiverState);

            this.deviceLog('monitor updated device values');

            if (!this.getAvailable()) {
                this.setAvailable().catch(this.error)
            }
        });

        // TODO: could look at enabling play info again
        // return Promise.all([
        //     this.getClient().getState().then((receiverState) => {
        //         this.syncReceiverStateToCapabilities(receiverState);
        //
        //         this.deviceLog('monitor updated device values');
        //
        //         if (!this.getAvailable()) {
        //             this.setAvailable().catch(this.error)
        //         }
        //     }),
        //     this.getClient().getPlayInfo().then(playInfo => {
        //         this.syncReceiverPlayIntoToCapabilities(playInfo);
        //     })
        // ]);
    }

    _onCapabilitiesSet(valueObj, optsObj) {
        console.log(valueObj, optsObj);

        return true;
    }

    deviceLog(...message) {
        // console.log('data',this.getData(), 'state', this.getState(), 'settings', this.getSettings());
        this.log('Yamaha Device [' + this._data.id + ']', ...message);
    }

    /**
     * @returns YamahaReceiverClient
     */
    getClient() {
        if (typeof this._yamahaReceiverClient === "undefined" || this._yamahaReceiverClient === null) {
            this._yamahaReceiverClient = new YamahaReceiverClient(this.getURLBase(), this.getControlURL());
        }

        return this._yamahaReceiverClient;
    }

    syncReceiverStateToCapabilities(state) {
        this.setCapabilityValueSafe('onoff', state.power || false).catch(this.error);

        if (typeof state.input.selected !== "undefined") {
            if (this.getCapabilityValue('input_selected') !== state.input.selected) {
                this.inputChangedTrigger.trigger(this, {
                    input: state.input.selected
                }).catch(this.error);
            }

            this.setCapabilityValueSafe('input_selected', state.input.selected).catch(this.error);
        }

        if (typeof state.surround.program !== "undefined") {
            if (this.getCapabilityValue('surround_program') !== state.surround.program) {
                this.surroundProgramChangedTrigger.trigger(this, {
                    surround_program: state.surround.program
                }).catch(this.error)
            }

            this.setCapabilityValueSafe('surround_program', state.surround.program).catch(this.error);
        }

        if (typeof state.volume.muted !== "undefined") {
            if (this.getCapabilityValue('volume_mute') !== state.volume.muted) {
                if (state.volume.muted) {
                    this.mutedTrigger.trigger(this).catch(this.error);
                } else {
                    this.unmutedTrigger.trigger(this).catch(this.error);
                }
            }

            this.setCapabilityValueSafe('volume_mute', state.volume.muted).catch(this.error);
        }

        if (typeof state.volume.current !== "undefined") {
            this.setCapabilityValueSafe('volume_set', state.volume.current / 100).catch(this.error);
        }
        if (typeof state.surround.straight !== "undefined") {
            this.setCapabilityValueSafe('surround_straight', state.surround.straight).catch(this.error);
        }
        if (typeof state.surround.enhancer !== "undefined") {
            this.setCapabilityValueSafe('surround_enhancer', state.surround.enhancer).catch(this.error);
        }
        if (typeof state.sound.direct !== "undefined") {
            this.setCapabilityValueSafe('sound_direct', state.sound.direct).catch(this.error);
        }
        if (typeof state.sound.extraBass !== "undefined") {
            this.setCapabilityValueSafe('sound_extra_bass', state.sound.extraBass).catch(this.error);
        }
        if (typeof state.sound.adaptiveDynamicRangeControl !== "undefined") {
            this.setCapabilityValueSafe('sound_adaptive_drc', state.sound.adaptiveDynamicRangeControl).catch(this.error);
        }
    }

    syncReceiverPlayIntoToCapabilities(playInfo) {
        this.setCapabilityValueSafe('speaker_playing', playInfo.playing).catch(this.error);
        this.setCapabilityValueSafe('speaker_track', playInfo.track).catch(this.error);
        this.setCapabilityValueSafe('speaker_album', playInfo.album).catch(this.error);
        this.setCapabilityValueSafe('speaker_artist', playInfo.artist).catch(this.error);
    }

    setCapabilityValueSafe(capabilityId, value) {
        return this.setCapabilityValue(capabilityId, value).catch(error => {
            Log.addBreadcrumb(
                'receiver_device',
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

        if (typeof this.monitorTimeout !== "undefined") {
            clearTimeout(this.monitorTimeout)
        }
    }
}

module.exports = YamahaReceiverDevice;
