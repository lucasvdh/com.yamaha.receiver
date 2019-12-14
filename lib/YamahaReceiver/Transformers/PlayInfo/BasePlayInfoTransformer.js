'use strict';

const xml2js = require('xml2js');
const BaseTransformer = require('../BaseTransformer');

class BasePlayInfoTransformer extends BaseTransformer {

    transformPlayInfo(xmlResponse) {
        let defaultPlayInfo = {
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
                return [
                    defaultPlayInfo,
                    availabilityResult,
                    playbackInfoResult,
                    metaInfoResult
                ];
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


module.exports = BasePlayInfoTransformer;