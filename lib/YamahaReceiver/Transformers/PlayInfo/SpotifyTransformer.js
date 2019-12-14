'use strict';

const BasePlayInfoTransformer = require('./BasePlayInfoTransformer');

class SpotifyTransformer extends BasePlayInfoTransformer {

    constructor() {
        super('Spotify');
    }

    transform(xmlResponse) {
        return this.transformPlayInfo(xmlResponse).then(args => {
            let playInfo = args[0],
                availabilityResult = args[1],
                playbackInfoResult = args[2],
                metaInfoResult = args[3];

            playInfo.available = availabilityResult === 'Ready';
            playInfo.playing = playbackInfoResult === 'Play';
            playInfo.artist = this.getAttributeFromXMLArray(metaInfoResult, 'Artist');
            playInfo.album = this.getAttributeFromXMLArray(metaInfoResult, 'Album');
            playInfo.track = this.getAttributeFromXMLArray(metaInfoResult, 'Track');

            return playInfo;
        });
    }
}


module.exports = SpotifyTransformer;