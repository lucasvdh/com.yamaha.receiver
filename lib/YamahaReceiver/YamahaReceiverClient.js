'use strict';

const axios = require('axios');
const Entities = new (require('html-entities').XmlEntities)();
const SurroundProgramEnum = require('./Enums/SurroundProgramEnum');
const InputEnum = require('./Enums/InputEnum');
const BasicStatusTransformer = require('./Transformers/BasicStatusTransformer');
const PlayInfoTransformer = require('./Transformers/PlayInfoTransformer');
const Log = require('../../lib/Log');

class YamahaReceiverClient {

    constructor(ipAddress) {
        this.ipAddress = ipAddress;
        this.inputs = Object.values(InputEnum);
        this.surroundPrograms = Object.values(SurroundProgramEnum);
        this.state = {
            input: {},
            surround: {},
            sound: {},
        };
        this._onSuccess = null;
        this._onError = null;
    }

    setSurroundProgram(surroundProgram) {
        console.log('set surround', surroundProgram);

        if (!this.validateSurroundProgram(surroundProgram)) {
            throw new Error('Invalid surround program "' + surroundProgram + '"');
        }

        return this.put(this.getMainZone(), '<Surround><Program_Sel><Current><Straight>Off</Straight><Sound_Program>' + surroundProgram + '</Sound_Program></Current></Program_Sel></Surround>');
    }

    setSurroundStraight(straight) {
        let straightState = straight === true ? 'On' : 'Off';

        return this.put(this.getMainZone(), '<Surround><Program_Sel><Current><Straight>' + straightState + '</Straight></Current></Program_Sel></Surround>');
    }

    setSurroundEnhancer(enhancer) {
        let enhancerState = enhancer === true ? 'On' : 'Off';

        return this.put(this.getMainZone(), '<Surround><Program_Sel><Current><Enhancer>' + enhancerState + '</Enhancer></Current></Program_Sel></Surround>');
    }

    setSoundDirect(direct) {
        let directState = direct === true ? 'On' : 'Off';

        return this.put(this.getMainZone(), '<Sound_Video><Direct><Mode>' + directState + '</Mode></Direct></Sound_Video>');
    }

    setSoundExtraBass(extraBass) {
        let extraBassState = extraBass === true ? 'Auto' : 'Off';

        return this.put(this.getMainZone(), '<Sound_Video><Extra_Bass>' + extraBassState + '</Extra_Bass></Sound_Video>');
    }

    setSoundAdaptiveDRC(adaptiveDRC) {
        let adaptiveDRCState = adaptiveDRC === true ? 'On' : 'Off';

        return this.put(this.getMainZone(), '<Sound_Video><Adaptive_DRC>' + adaptiveDRCState + '</Adaptive_DRC></Sound_Video>');
    }

    setLine(line) {
        return this.put(this.getMainZone(), '<List_Control><Direct_Sel>Line_' + line + '</Direct_Sel></List_Control>');
    }

    setInput(input) {
        if (!this.validateInput(input)) {
            throw new Error('Invalid source "' + input + '"');
        }

        return this.put(this.getMainZone(), '<Input><Input_Sel>' + input + '</Input_Sel></Input>');
    }

    setMuted(muted) {
        let mutedState = muted === true ? 'On' : 'Off';

        return this.put(this.getMainZone(), '<Volume><Mute>' + mutedState + '</Mute></Volume>');
    }

    setPower(power) {
        let powerState = power === true ? 'On' : 'Standby';

        return this.put(this.getMainZone(), '<Power_Control><Power>' + powerState + '</Power></Power_Control>');
    }

    setVolume(volume) {
        let dbVolume = this.percentileToDecibel(volume);
        return this.put(this.getMainZone(), `<Volume><Lvl><Val>${dbVolume}</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume>`);
    }

    getZone() {
        return new Promise((resolve, reject) => {
            if (typeof this.state.input.selected === "undefined") {
                this.getState().then(state => {
                    resolve(this.getZoneByInput(state.input.selected));
                }).catch(reject);
            } else {
                resolve(this.getZoneByInput(this.state.input.selected));
            }
        });
    }

    play() {
        return this.putPlayControlPlayback('Play');
    }

    pause() {
        return this.putPlayControlPlayback('Pause');
    }

    next() {
        return this.putPlayControlPlayback('Skip Fwd');
    }

    previous() {
        return this.putPlayControlPlayback('Skip Rev');
    }

    putPlayControlPlayback(value) {
        return this.put(this.getMainZone(), '<Play_Control><Playback>' + value + '</Playback></Play_Control>');
        // TODO: it might be necessary to re-enable this if it fails for some sources.
        //  Tested with Spotify and was able to play/pause via main zone.
        // return this.getZone().then(zone => {
        // });
    }

    getPlayInfo() {
        let playInfo = {
            available: false,
            playing: false,
            artist: null,
            album: null,
            track: null,
        };

        return this.getZone().then(zone => {
            if (this.hasPlayInfo(zone)) {
                return this.get(zone, '<Play_Info>GetParam</Play_Info>').then(xmlResponse => {
                    return new PlayInfoTransformer(zone).transform(xmlResponse);
                });
            } else {
                return Promise.resolve(playInfo);
            }
        });
    }

    hasPlayInfo(zone) {
        let supportedZones = [
            this.getUSBZone(),
            this.getIPodUSBZone(),
            this.getSpotifyZone(),
            this.getNetRadioZone(),
            this.getServerZone(),
            this.getJukeZone(),
            this.getTunerZone(),
            this.getAirPlayZone(),
            this.getDeezerZone(),
            this.getMusicCastLinkZone()
        ];

        return supportedZones.indexOf(zone) !== -1;
    }

    getState() {
        return this.request('GET', this.getMainZone(), '<Basic_Status>GetParam</Basic_Status>')
            .then(xmlResponse => {
                return new BasicStatusTransformer()
                    .transform(xmlResponse);
            });
    }

    get(zone, body) {
        return this.request('GET', zone, body);
    }

    put(zone, body) {
        return this.request('PUT', zone, body);
    }

    request(method, zone, body) {
        let url = 'http://' + this.ipAddress + '/YamahaRemoteControl/ctrl';

        body = '<YAMAHA_AV cmd="' + method + '"><' + zone + '>' + body + '</' + zone + '></YAMAHA_AV>';

        Log.addBreadcrumb(
            'receiver_client',
            'Sending request',
            {
                url: url,
                method: 'POST',
                zone: zone,
                body: body,
            },
            Log.Severity.Info
        );

        let result = axios
            .post(url, body)
            .then((data) => {
                Log.addBreadcrumb(
                    'receiver_client',
                    'Received response',
                    {
                        url: url,
                        method: 'POST',
                        zone: zone,
                        body: body,
                        response: data.data,
                    },
                    Log.Severity.Info
                );

                return data.data;
            })
            .catch(error => {
                Log.captureException(error);
                return error;
            });

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
        let max = 970,
            offset = 805,
            stepSize = 5,
            decibelVolume = parseInt((max * (percentile / 100)) - offset),
            diff = decibelVolume % stepSize;

        if (diff < (stepSize / 2)) {
            return parseInt(decibelVolume - diff);
        } else {
            return parseInt(decibelVolume + (stepSize - diff));
        }
    }

    onSuccess(callback) {
        this._onSuccess = callback;
    }

    onError(callback) {
        this._onError = callback;
    }

    getSystemZone() {
        return 'System';
    }

    getMainZone() {
        return 'Main_Zone';
    }

    getTunerZone() {
        return 'Tuner';
    }

    getAirPlayZone() {
        return 'AirPlay';
    }

    getDeezerZone() {
        return 'Deezer';
    }

    getSpotifyZone() {
        return 'Spotify';
    }

    getIPodUSBZone() {
        return 'iPod_USB';
    }

    getUSBZone() {
        return 'USB';
    }

    getNetRadioZone() {
        return 'NET_RADIO';
    }

    getServerZone() {
        return 'SERVER';
    }

    getJukeZone() {
        return 'Juke';
    }

    getMusicCastLinkZone() {
        return 'MusicCast Link';
    }

    getZoneByInput(input) {
        let supportedInputs = {
            'HDMI1': this.getMainZone(),
            'HDMI2': this.getMainZone(),
            'HDMI3': this.getMainZone(),
            'HDMI4': this.getMainZone(),
            'HDMI5': this.getMainZone(),
            'HDMI6': this.getMainZone(),
            'HDMI7': this.getMainZone(),
            'HDMI8': this.getMainZone(),
            'AV1': this.getMainZone(),
            'AV2': this.getMainZone(),
            'AV3': this.getMainZone(),
            'AV4': this.getMainZone(),
            'AV5': this.getMainZone(),
            'AV6': this.getMainZone(),
            'AUDIO1': this.getMainZone(),
            'AUDIO2': this.getMainZone(),
            'AUDIO3': this.getMainZone(),
            'TUNER': this.getTunerZone(),
            'AirPlay': this.getAirPlayZone(),
            'Spotify': this.getSpotifyZone(),
            'Deezer': this.getDeezerZone(),
            'IPOD_USB': this.getIPodUSBZone(),
            'USB': this.getUSBZone(),
            'NET_RADIO': this.getNetRadioZone(),
            'MusicCast Link': this.getMusicCastLinkZone(),
        };

        if (typeof supportedInputs[input] === "undefined") {
            throw new Error('Could not find zone by input [' + input + ']')
        }

        return supportedInputs[input];
    }

    getArtistFromMeta(metaInfoResult) {
        return Entities.decode(this.getAttributeFromXMLArray(metaInfoResult, ['Artist']));
    }

    getAlbumFromMeta(metaInfoResult) {
        return Entities.decode(this.getAttributeFromXMLArray(metaInfoResult, ['Album']));
    }

    getTrackFromMeta(metaInfoResult) {
        return Entities.decode(this.getAttributeFromXMLArray(metaInfoResult, ['Track','Song']));
    }

    getAttributeFromXMLArray(array, names) {
        for (let i in array) {
            if (this.attributeExistsXMLArray(array, names[i])) {
                return array[names[i]][0];
            }
        }
        return null;
    }

    attributeExistsXMLArray(array, name) {
        return typeof array[name] !== "undefined"
            && typeof array[name][0] !== "undefined";
    }
}

module.exports = YamahaReceiverClient;
