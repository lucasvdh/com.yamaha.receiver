'use strict';

const xml2js = require("xml2js");
const Log = require("../../Log");
const BaseTransformer = require('./BaseTransformer');

class PlayInfoTransformer extends BaseTransformer {

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
            playInfo.track = this.getAttributeFromXMLArray(metaInfoResult, ['Song', 'Track']);

            return playInfo;
        });
    }

    transformPlayInfo(xmlResponse) {
        let defaultPlayInfo = {
            available: false,
            playing: false,
            artist: null,
            album: null,
            track: null,
        };

        return new Promise((resolve, reject) => {
            xml2js.parseStringPromise(xmlResponse)
                .then(result => {
                    let availabilityResult = this.getFeatureAvailabilityResult(result),
                        playbackInfoResult = this.getPlaybackInfoResult(result),
                        metaInfoResult = this.getMetaInfoResult(result);
                    resolve([
                        defaultPlayInfo,
                        availabilityResult,
                        playbackInfoResult,
                        metaInfoResult
                    ]);
                }).catch(error => {
                Log.addBreadcrumb(
                    'play_info_transformer',
                    'Could not parse xml',
                    {
                        error: JSON.stringify(error)
                    },
                    Log.Severity.Error
                );

                reject('Could not parse response');
            });
        });
    }

    getPlayInfoResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getZoneResult(result),
            'Play_Info'
        );
    }

    getFeatureAvailabilityResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getPlayInfoResult(result),
            'Feature_Availability'
        );
    }

    getPlaybackInfoResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getPlayInfoResult(result),
            'Playback_Info'
        );
    }

    getMetaInfoResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getPlayInfoResult(result),
            'Meta_Info'
        );
    }
}


module.exports = PlayInfoTransformer;