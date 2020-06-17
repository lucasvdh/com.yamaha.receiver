'use strict';

const xml2js = require('xml2js');
const Log = require('../../Log');
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
        return new Promise((resolve, reject) => {
            xml2js.parseStringPromise(xmlResponse)
                .then(result => {
                    resolve(this.getNetworkResult(result));
                }).catch(error => {
                Log.addBreadcrumb(
                    'network_transformer',
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