'use strict';

const axios = require('axios');
const SurroundProgramEnum = require('./enums/SurroundProgramEnum');
const InputEnum = require('./enums/InputEnum');
const Log = require('../../lib/Log');

class YamahaExtendedControlClient {

    constructor(urlBase, serviceUrl, zone, multicastName = null, multicastPort = null) {
        this.urlBase = this.trim(urlBase, '/');
        this.serviceUrl = this.trim(serviceUrl, '/');
        this.zone = zone;
        this.multicastName = multicastName;
        this.multicastPort = multicastPort;
        this.inputs = Object.values(InputEnum);
        this.surroundPrograms = Object.values(SurroundProgramEnum);
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

    setShuffle(shuffle) {

    }

    play() {
        return this.setPlayback('play');
    }

    stop() {
        return this.setPlayback('stop');
    }

    pause() {
        return this.setPlayback('pause');
    }

    previous() {
        return this.setPlayback('previous');
    }

    next() {
        return this.setPlayback('next');
    }

    setPlayback(action) {
        return this.getZoneBySelectedInput().then(zone => {
            return this.request(zone, 'setPlayback?playback=' + action);
        });
    }

    setPower(power) {
        let powerState = power === true ? 'on' : 'standby';

        return this.request(this.zone, 'setPower?power=' + powerState);
    }

    getZoneBySelectedInput() {
        return this.getState().then(state => {
            switch (state.input) {
                case 'server':
                case 'net_radio':
                case 'pandora':
                case 'spotify':
                case 'airplay':
                case 'napster':
                case 'juke':
                case 'qobuz':
                case 'tidal':
                case 'deezer':
                case 'mc_link':
                case 'bluetooth':
                    return 'netusb';
                case 'cd':
                    return 'cd';
            }

            return 'main';
        });
    }

    setVolume(volume) {
        return this.request(this.zone, 'setVolume?volume=' + Math.floor(volume));
    }

    volumeUp(stepSize) {
        return this.request(this.zone, 'setVolume?volume=up&step=' + stepSize);
    }

    volumeDown(stepSize) {
        return this.request(this.zone, 'setVolume?volume=down&step=' + stepSize);
    }

    getName() {
        return this.request('system', 'getNameText?id=main').then(data => data.text);
    }

    getDeviceInfo() {
        return this.request('system', 'getDeviceInfo').then(data => {
            let tags = {};

            if (typeof data.model_name !== "undefined") {
                tags.model = data.model_name;
            }
            if (typeof data.system_version !== "undefined") {
                tags.systemVersion = data.system_version;
            }
            if (typeof data.api_version !== "undefined") {
                tags.apiVersion = data.api_version;
            }

            Log.setTags(tags);
        });
    }

    getFeatures() {
        return this.request('system', 'getFeatures?id=main');
    }

    getState() {
        return this.request('main', 'getStatus')
            .then(response => {
                return {
                    power: response.power === 'on',
                    volume: response.volume,
                    muted: response.mute,
                    input: this.validateInput(response.input) ? response.input : null,
                    sound_program: this.validateSurroundProgram(response.sound_program) ? response.sound_program : null,
                    max_volume: response.max_volume
                };
            });
    }

    getPlayInfo() {
        return this.getZoneBySelectedInput().then(zone => {
            return this.request(zone, 'getPlayInfo')
                .then(response => {
                    return {
                        input: response.input,
                        playing: response.playback === 'play',
                        paused: response.playback === 'pause',
                        stopped: response.playback === 'stop',
                        playback: response.playback,
                        repeat: response.repeat,
                        shuffle: response.shuffle !== 'off',
                        play_time: response.play_time,
                        total_time: response.total_time,
                        artist: response.artist,
                        album: response.album,
                        track: response.track,
                        albumart_url: this.urlBase + response.albumart_url,
                    };
                });
        });
    }

    request(zone, action) {
        return new Promise((resolve, reject) => {
            let url = this.urlBase + '/' + this.serviceUrl + '/' + zone + '/' + action,
                config = this.getConfig();

            Log.addBreadcrumb(
                'musiccast_client',
                'Sending request',
                {
                    url: url,
                    method: 'GET'
                },
                Log.Severity.Info
            );

            axios
                .get(url, config)
                .then(response => {
                    if (response.data.response_code > 0) {
                        Log.addBreadcrumb(
                            'musiccast_client',
                            'Received error response',
                            {
                                url: url,
                                method: 'GET',
                                response: response.data,
                            },
                            Log.Severity.Error
                        );

                        reject('Invalid response');
                    } else {
                        Log.addBreadcrumb(
                            'musiccast_client',
                            'Received response',
                            {
                                url: url,
                                method: 'GET',
                                response: response.data,
                            },
                            Log.Severity.Info
                        );

                        resolve(response.data);
                    }
                }).catch(reject);
        });
    }

    getConfig() {
        let config = {};

        if (this.multicastName && this.multicastPort) {
            config.headers = {
                'X-AppName': 'MusicCast/' + this.multicastName,
                'X-AppPort': this.multicastPort
            }
        }

        return config;
    }

    validateInput(source) {
        return this.inputs.indexOf(source) > -1;
    }

    validateSurroundProgram(surroundProgram) {
        return this.surroundPrograms.indexOf(surroundProgram) > -1;
    }
}

module.exports = YamahaExtendedControlClient;