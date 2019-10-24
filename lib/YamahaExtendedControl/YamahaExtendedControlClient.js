'use strict';

const axios = require('axios');
const xml2js = require('xml2js');
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
        return this.request(this.zone, 'setSoundProgram?program=' + surroundProgram);
    }

    setInput(input) {
        if (!this.validateSource(input)) {
            throw new Error('Invalid source');
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

    getFeatures() {
        return this.request('system', 'getFeatures?id=main');
    }

    getState() {
        return this.request(this.zone, 'getStatus')
            .then(response => {
                return xml2js.parseStringPromise(xmlResponse)
                    .then(result => {
                        let statusResult = result['YAMAHA_AV']['Main_Zone'][0]['Basic_Status'][0],
                            powerResult = statusResult['Power_Control'][0],
                            volumeResult = statusResult['Volume'][0],
                            inputResult = statusResult['Input'][0],
                            surroundResult = statusResult['Surround'][0],
                            currentSurroundResult = surroundResult['Program_Sel'][0]['Current'][0],
                            soundVideoResult = statusResult['Sound_Video'][0],
                            state = {
                                volume: {},
                                input: {},
                                surround: {},
                                sound: {},
                            };

                        state.power = powerResult['Power'][0] === 'On';
                        state.volume.current = this.decibelToPercentile(volumeResult['Lvl'][0]['Val'][0]);
                        state.volume.muted = volumeResult['Mute'][0] === 'On';
                        state.volume.subwooferTrim = volumeResult['Subwoofer_Trim'][0]['Val'][0];
                        state.volume.displayScale = volumeResult['Scale'][0];
                        state.input.selected = inputResult['Input_Sel'][0];
                        state.input.title = inputResult['Input_Sel_Item_Info'][0]['Title'][0];
                        state.surround.program = currentSurroundResult['Sound_Program'][0];
                        state.surround.straight = currentSurroundResult['Straight'][0] === 'On';
                        state.surround.enhancer = currentSurroundResult['Enhancer'][0] === 'On';
                        state.sound.direct = soundVideoResult['Direct'][0]['Mode'][0] === 'On';
                        state.sound.extraBass = soundVideoResult['Extra_Bass'][0] !== 'Off';
                        state.sound.adaptiveDynamicRangeControl = soundVideoResult['Adaptive_DRC'][0] !== 'Off';

                        return state;
                    });
            });
    }

    put(body) {
        return this.request('PUT', body);
    }

    request(zone, method) {
        return axios
            .get('http://' + this.ipAddress + '/YamahaExtendedControl/v1/' + zone + '/' + method)
            .then(data => data.data);
    }

    validateSource(source) {
        return this.sources.indexOf(source) !== -1;
    }
}

module.exports = YamahaExtendedControlClient;