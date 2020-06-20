'use strict';

const xml2js = require('xml2js');
const BaseTransformer = require('./BaseTransformer');

class BasicStatusTransformer extends BaseTransformer {

    constructor() {
        super('Main_Zone');
    }

    transform(xmlResponse) {
        return this.transformBasicStatus(xmlResponse).then(args => {
            let state = args[0],
                powerResult = args[1],
                volumeResult = args[2],
                inputResult = args[3],
                currentSurroundResult = args[4],
                soundVideoResult = args[5];

            if (powerResult !== null) {
                state.power = this.getAttributeFromXMLArray(powerResult, 'Power') === 'On';
            }

            if(volumeResult !== null) {
                state.volume.current = this.decibelToPercentile(parseInt(
                    this.getAttributeFromXMLArray(volumeResult, 'Lvl.Val')
                ));
                state.volume.muted = this.getAttributeFromXMLArray(volumeResult, 'Mute') === 'On';
                state.volume.subwooferTrim = this.getAttributeFromXMLArray(volumeResult, 'Subwoofer_Trim.Val');
                state.volume.displayScale = this.getAttributeFromXMLArray(volumeResult, [
                    'Scale',
                    'Lvl.Unit'
                ]);
            }

            if (inputResult !== null) {
                state.input.selected = this.getAttributeFromXMLArray(inputResult, 'Input_Sel');
                state.input.title = this.getAttributeFromXMLArray(inputResult, 'Input_Sel_Item_Info.Title');
            }

            if (currentSurroundResult !== null) {
                state.surround.program = this.getAttributeFromXMLArray(currentSurroundResult, 'Sound_Program');
                state.surround.straight = this.getAttributeFromXMLArray(currentSurroundResult, 'Straight') === 'On';
                state.surround.enhancer = this.getAttributeFromXMLArray(currentSurroundResult, 'Enhancer') === 'On';
            }

            if (soundVideoResult !== null) {
                state.sound.direct = this.getAttributeFromXMLArray(soundVideoResult, [
                    'Direct.Mode',
                    'Pure_Direct.Mode',
                ]) === 'On';
                state.sound.extraBass = this.getAttributeFromXMLArray(soundVideoResult, 'Extra_Bass') !== 'Off';
                state.sound.adaptiveDynamicRangeControl = this.getAttributeFromXMLArray(soundVideoResult, 'Adaptive_DRC') !== 'Off';
            }

            return state;
        });
    }

    transformBasicStatus(xmlResponse) {
        let defaultState = {
            volume: {},
            input: {},
            surround: {},
            sound: {},
        };

        return xml2js.parseStringPromise(xmlResponse)
            .then(result => {
                let powerResult = this.getPowerResult(result),
                    volumeResult = this.getVolumeResult(result),
                    inputResult = this.getInputResult(result),
                    currentSurroundResult = this.getCurrentSurroundResult(result),
                    soundVideoResult = this.getSoundVideoResult(result);

                return [
                    defaultState,
                    powerResult,
                    volumeResult,
                    inputResult,
                    currentSurroundResult,
                    soundVideoResult
                ];
            });
    }

    getBasicStatusResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getZoneResult(result),
            'Basic_Status'
        );
    }

    getPowerResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getBasicStatusResult(result),
            'Power_Control'
        );
    }

    getVolumeResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getBasicStatusResult(result),
            [
                'Volume',
                'Vol',
            ]
        );
    }

    getInputResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getBasicStatusResult(result),
            'Input'
        );
    }

    getCurrentSurroundResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getBasicStatusResult(result),
            'Surround.Program_Sel.Current'
        );
    }

    getSoundVideoResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getBasicStatusResult(result),
            'Sound_Video'
        );
    }

    decibelToPercentile(decibel) {
        let max = 970,
            offset = 805;

        return parseFloat(((decibel + offset) / (max / 100)).toPrecision(4));
    }
}


module.exports = BasicStatusTransformer;