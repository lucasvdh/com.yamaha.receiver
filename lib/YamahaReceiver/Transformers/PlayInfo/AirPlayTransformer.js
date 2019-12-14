'use strict';

const BasePlayInfoTransformer = require('./BasePlayInfoTransformer');

class SpotifyTransformer extends BasePlayInfoTransformer {

    constructor() {
        super('Spotify');
    }

    transform(xmlResponse) {
        return this.transformPlayInfo(xmlResponse).then((
            playInfo,
            availabilityResult,
            playbackInfoResult,
            metaInfoResult
        ) => {
            playInfo.available = availabilityResult === 'Ready';
            playInfo.playing = playbackInfoResult === 'Play';
            playInfo.artist = this.getAttributeFromXMLArray(metaInfoResult, 'Artist');
            playInfo.album = this.getAttributeFromXMLArray(metaInfoResult, 'Album');
            playInfo.track = this.getAttributeFromXMLArray(metaInfoResult, 'Song');

            return playInfo;
        });
    }
}


module.exports = SpotifyTransformer;