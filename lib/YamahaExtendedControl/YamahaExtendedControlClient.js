'use strict';

const axios = require('axios');
const SurroundProgramEnum = require('./enums/SurroundProgramEnum');
const InputEnum = require('./enums/InputEnum');

class YamahaExtendedControlClient {

    constructor(ipAddress, zone) {
        this.ipAddress = ipAddress;
        this.zone = zone;
        this.inputs = Object.values(InputEnum);
        this.surroundPrograms = Object.values(SurroundProgramEnum);
    }

    setSurroundProgram(surroundProgram) {
        if (!this.validateSurroundProgram(surroundProgram)) {
            throw new Error('Invalid surround program "' + surroundProgram + '"');
        }

        return this.request(this.zone, 'setSoundProgram?program=' + surroundProgram);
    }

    setInput(input) {
        if (!this.validateInput(input)) {
            throw new Error('Invalid source "' + input + '"');
        }

        return this.request(this.zone, 'setInput?input=' + input);
    }

    setMuted(muted) {
        return this.request(this.zone, 'setMute?enable=' + muted);
    }

    setPower(power) {
        let powerState = power === true ? 'on' : 'standby';

        return this.request(this.zone, 'setPower?power=' + powerState);
    }

    setVolume(volume) {
        return this.request(this.zone, 'setVolume?volume=' + volume);
    }

    getName() {
        return this.request('system', 'getNameText?id=main');
    }

    getDeviceInfo() {
        return this.request('system', 'getDeviceInfo');
    }

    getFeatures() {
        return this.request('system', 'getFeatures?id=main');
    }

    getState() {
        return this.request(this.zone, 'getStatus')
            .then(response => {
                return {
                    power: response.power === 'on',
                    volume: response.volume,
                    muted: response.mute,
                    input: response.input,
                    sound_program: response.sound_program
                };
            });
    }

    request(zone, action) {
        return axios
            .get('http://' + this.ipAddress + '/YamahaExtendedControl/v1/' + zone + '/' + action)
            .then(data => data.data);
    }

    validateInput(source) {
        return this.inputs.indexOf(source) > -1;
    }

    validateSurroundProgram(surroundProgram) {
        return this.surroundPrograms.indexOf(surroundProgram) > -1;
    }
}

module.exports = YamahaExtendedControlClient;