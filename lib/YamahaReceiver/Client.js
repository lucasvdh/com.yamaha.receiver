'use strict';

const axios = require('axios');
const Entities = new (require('html-entities').XmlEntities)();
const Enums = require('./Enums');
const BasicStatusTransformer = require('./Transformers/BasicStatusTransformer');
const PlayInfoTransformer = require('./Transformers/PlayInfoTransformer');
const NetworkNameTransformer = require('./Transformers/NetworkNameTransformer');
const Log = require('../Log');

class Client {

    constructor(urlBase, controlURL, zone = null) {
        this.urlBase = this.trim(urlBase, '/');
        this.controlURL = this.trim(controlURL, '/');
        this.zone = zone;
        this.inputs = Object.values(Enums.InputEnum);
        this.surroundPrograms = Object.values(Enums.SurroundProgramEnum);
        this.zones = Object.values(Enums.ZoneEnum);
        this.state = {
            input: {},
            surround: {},
            sound: {},
        };
        this._onSuccess = null;
        this._onError = null;
    }

    trim(str, charlist) {
        if (typeof charlist == 'undefined') {
            charlist = '\\s';
        }
        return str.replace(new RegExp('^[' + charlist + ']*(.*?)[' + charlist + ']*$'), '$1')
    }

    setSurroundProgram(surroundProgram) {
        if (!this.validateSurroundProgram(surroundProgram)) {
            throw new Error('Invalid surround program "' + surroundProgram + '"');
        }

        return this.put(this.getZone(), '<Surround><Program_Sel><Current><Straight>Off</Straight><Sound_Program>' + surroundProgram + '</Sound_Program></Current></Program_Sel></Surround>');
    }

    setSurroundStraight(straight) {
        let straightState = straight === true ? 'On' : 'Off';

        return this.put(this.getZone(), '<Surround><Program_Sel><Current><Straight>' + straightState + '</Straight></Current></Program_Sel></Surround>');
    }

    setSurroundEnhancer(enhancer) {
        let enhancerState = enhancer === true ? 'On' : 'Off';

        return this.put(this.getZone(), '<Surround><Program_Sel><Current><Enhancer>' + enhancerState + '</Enhancer></Current></Program_Sel></Surround>');
    }

    setSoundDirect(direct) {
        let directState = direct === true ? 'On' : 'Off';

        return this.put(this.getZone(), '<Sound_Video><Direct><Mode>' + directState + '</Mode></Direct></Sound_Video>');
    }

    setSoundExtraBass(extraBass) {
        let extraBassState = extraBass === true ? 'Auto' : 'Off';

        return this.put(this.getZone(), '<Sound_Video><Extra_Bass>' + extraBassState + '</Extra_Bass></Sound_Video>');
    }

    setSoundAdaptiveDRC(adaptiveDRC) {
        let adaptiveDRCState = adaptiveDRC === true ? 'On' : 'Off';

        return this.put(this.getZone(), '<Sound_Video><Adaptive_DRC>' + adaptiveDRCState + '</Adaptive_DRC></Sound_Video>');
    }

    setLine(line) {
        return this.put(this.getZone(), '<List_Control><Direct_Sel>Line_' + line + '</Direct_Sel></List_Control>');
    }

    setInput(input) {
        if (!this.validateInput(input)) {
            throw new Error('Invalid source "' + input + '"');
        }

        return this.put(this.getZone(), '<Input><Input_Sel>' + input + '</Input_Sel></Input>');
    }

    setMuted(muted) {
        let mutedState = muted === true ? 'On' : 'Off';

        return this.put(this.getZone(), '<Volume><Mute>' + mutedState + '</Mute></Volume>');
    }

    setPower(power) {
        let powerState = power === true ? 'On' : 'Standby';

        return this.put(this.getZone(), '<Power_Control><Power>' + powerState + '</Power></Power_Control>');
    }

    setVolume(volume) {
        let dbVolume = this.percentileToDecibel(volume);
        return this.put(this.getZone(), `<Volume><Lvl><Val>${dbVolume}</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume>`);
    }

    getZone() {
        return this.zone || this.getMainZone();
    }

    setZone(zone) {
        return new Promise((resolve, reject) => {
            if (this.validateZone(zone)) {
                this.zone = zone;
                resolve();
            } else {
                reject(new Errors.InvalidZone());
            }
        });
    }

    getCurrentZone() {
        return new Promise((resolve, reject) => {
            if (typeof this.state.input.selected === "undefined") {
                this.getState().then(state => {
                    if (typeof state.input.selected !== "undefined") {
                        resolve(this.getZoneByInput(state.input.selected));
                    } else {
                        reject('Current selected input not found in state');
                    }
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

        return this.getCurrentZone().then(zone => {
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

    getNetworkName() {
        return this.request('GET', this.getSystemZone(), '<Misc><Network><Network_Name>GetParam</Network_Name></Network></Misc>')
            .then(xmlResponse => {
                return new NetworkNameTransformer()
                    .transform(xmlResponse);
            });
    }

    getState() {
        return this.request('GET', this.getMainZone(), '<Basic_Status>GetParam</Basic_Status>')
            .then(xmlResponse => {
                return this.state = new BasicStatusTransformer()
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
        let url = this.urlBase + '/' + this.controlURL;

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

        return new Promise((resolve, reject) => {
            let result = axios
                .post(url, body)
                .then((response) => {
                    Log.addBreadcrumb(
                        'receiver_client',
                        'Received response',
                        {
                            url: url,
                            method: 'POST',
                            zone: zone,
                            body: body,
                            response: response.data,
                        },
                        Log.Severity.Info
                    );

                    resolve(response.data);
                })
                .catch(error => {
                    reject(error);
                });

            if (typeof this._onSuccess === "function") {
                result.then(this._onSuccess);
            }

            if (typeof this._onError === "function") {
                result.catch(this._onError);
            }
        });
    }

    validateInput(source) {
        return this.inputs.indexOf(source) > -1;
    }

    validateSurroundProgram(surroundProgram) {
        return this.surroundPrograms.indexOf(surroundProgram) > -1;
    }

    validateZone(zone) {
        return this.zones.indexOf(zone) > -1;
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
            'HDMI1': this.getZone(),
            'HDMI2': this.getZone(),
            'HDMI3': this.getZone(),
            'HDMI4': this.getZone(),
            'HDMI5': this.getZone(),
            'HDMI6': this.getZone(),
            'HDMI7': this.getZone(),
            'HDMI8': this.getZone(),
            'AV1': this.getZone(),
            'AV2': this.getZone(),
            'AV3': this.getZone(),
            'AV4': this.getZone(),
            'AV5': this.getZone(),
            'AV6': this.getZone(),
            'AUDIO1': this.getZone(),
            'AUDIO2': this.getZone(),
            'AUDIO3': this.getZone(),
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
        return Entities.decode(this.getAttributeFromXMLArray(metaInfoResult, ['Track', 'Song']));
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

module.exports = Client;
