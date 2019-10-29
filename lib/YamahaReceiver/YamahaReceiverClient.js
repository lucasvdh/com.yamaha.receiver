'use strict';

const axios = require('axios');
const xml2js = require('xml2js');
const SurroundProgramEnum = require('./enums/SurroundProgramEnum');
const InputEnum = require('./enums/InputEnum');

class YamahaReceiverClient {

    constructor(ipAddress, zone) {
        this.ipAddress = ipAddress;
        this.zone = zone;
        this.inputs = Object.values(InputEnum);
        this.surroundPrograms = Object.values(SurroundProgramEnum);
        this._onSuccess = null;
        this._onError = null;
    }

    setSurroundProgram(surroundProgram) {
        if (!this.validateSurroundProgram(surroundProgram)) {
            throw new Error('Invalid surround program "' + surroundProgram + '"');
        }

        return this.put('<Surround><Program_Sel><Current><Straight>Off</Straight><Sound_Program>' + surroundProgram + '</Sound_Program></Current></Program_Sel></Surround>');
    }

    setSurroundStraight(straight) {
        let straightState = straight === true ? 'On' : 'Off';

        return this.put('<Surround><Program_Sel><Current><Straight>' + straightState + '</Straight></Current></Program_Sel></Surround>');
    }

    setSurroundEnhancer(enhancer) {
        let enhancerState = enhancer === true ? 'On' : 'Off';

        return this.put('<Surround><Program_Sel><Current><Enhancer>' + enhancerState + '</Enhancer></Current></Program_Sel></Surround>');
    }

    setSoundDirect(direct) {
        let directState = direct === true ? 'On' : 'Off';

        return this.put('<Sound_Video><Direct><Mode>' + directState + '</Mode></Direct></Sound_Video>');
    }

    setSoundExtraBass(extraBass) {
        let extraBassState = extraBass === true ? 'Auto' : 'Off';

        return this.put('<Sound_Video><Extra_Bass>' + extraBassState + '</Extra_Bass></Sound_Video>');
    }

    setSoundAdaptiveDRC(adaptiveDRC) {
        let adaptiveDRCState = adaptiveDRC === true ? 'On' : 'Off';

        return this.put('<Sound_Video><Adaptive_DRC>' + adaptiveDRCState + '</Adaptive_DRC></Sound_Video>');
    }

    setLine(line) {
        return this.put('<List_Control><Direct_Sel>Line_' + line + '</Direct_Sel></List_Control>');
    }

    setInput(input) {
        if (!this.validateInput(input)) {
            throw new Error('Invalid source "' + input + '"');
        }

        return this.put('<Input><Input_Sel>' + input + '</Input_Sel></Input>');
    }

    setMuted(muted) {
        let mutedState = muted === true ? 'On' : 'Off';

        return this.put('<Volume><Mute>' + mutedState + '</Mute></Volume>');
    }

    setPower(power) {
        let powerState = power === true ? 'On' : 'Standby';

        return this.put('<Power_Control><Power>' + powerState + '</Power></Power_Control>');
    }

    setVolume(volume) {
        volume = this.percentileToDecibel(volume);

        return this.put('<Volume><Lvl><Val>' + volume + '</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume>');
    }

    getState() {
        return this.request('GET', '<Basic_Status>GetParam</Basic_Status>')
            .then(xmlResponse => {
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

    request(method, body) {
        body = '<YAMAHA_AV cmd="' + method + '"><' + this.zone + '>' + body + '</' + this.zone + '></YAMAHA_AV>';

        let result = axios
            .post('http://' + this.ipAddress + '/YamahaRemoteControl/ctrl', body)
            .then(data => data.data);

        if (typeof this._onSuccess === "function") {
            result.then(this._onSuccess);
        }

        if (typeof this._onError === "function") {
            result.catch(this._onError);
        }

        return result;
    }

    validateInput(source) {
        return this.inputs.indexOf(source) > -1;
    }

    validateSurroundProgram(surroundProgram) {
        return this.surroundPrograms.indexOf(surroundProgram) > -1;
    }

    percentileToDecibel(percentile) {
        return (((100 - (percentile + 19.5)) * 10) * -1)
    }

    decibelToPercentile(decibel) {
        return parseFloat((100 - (((decibel * -1) + 200) / 10) + 0.5).toPrecision(1))
    }

    onSuccess(callback) {
        this._onSuccess = callback;
    }

    onError(callback) {
        this._onError = callback;
    }
}

module.exports = YamahaReceiverClient;