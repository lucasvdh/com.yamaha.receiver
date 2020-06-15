'use strict';

const xml2js = require('xml2js');
const BaseTransformer = require('./BaseTransformer');

class NetworkNameTransformer extends BaseTransformer {

    constructor() {
        super('System');
    }

    transform(xmlResponse) {
        return this.transformNetwork(xmlResponse).then(network => {
            return this.getAttributeFromXMLArray(network, 'Network_Name');
        });
    }

    transformNetwork(xmlResponse) {
        return xml2js.parseStringPromise(xmlResponse)
            .then(result => {
                return this.getNetworkResult(result);
            });
    }

    getMiscResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getZoneResult(result),
            'Misc'
        );
    }

    getNetworkResult(result) {
        return this.getStrictAttributeFromXMLArray(
            this.getMiscResult(result),
            'Network'
        );
    }
}


module.exports = NetworkNameTransformer;