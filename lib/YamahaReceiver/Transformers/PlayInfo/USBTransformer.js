'use strict';

const xml2js = require('xml2js');
const BaseTransformer = require('../BaseTransformer');

class AirPlayTransformer extends BaseTransformer {

    constructor() {
        super('USB');
    }

    transform(xmlResponse) {
        let playInfo = {
            available: false,
            playing: false,
            artist: null,
            album: null,
            track: null,
        };

        return xml2js.parseStringPromise(xmlResponse)
            .then(result => {
                let availabilityResult = this.getFeatureAvailabilityResult(result),
                    playbackInfoResult = this.getPlaybackInfoResult(result),
                    metaInfoResult = this.getMetaInfoResult(result);

                playInfo.available = availabilityResult === 'Ready';
                playInfo.playing = playbackInfoResult === 'Play';
                playInfo.artist = this.getAttributeFromXMLArray(metaInfoResult, 'Artist');
                playInfo.album = this.getAttributeFromXMLArray(metaInfoResult, 'Album');
                playInfo.track = this.getAttributeFromXMLArray(metaInfoResult, 'Song');

                return playInfo;
            });
    }
}


module.exports = AirPlayTransformer;