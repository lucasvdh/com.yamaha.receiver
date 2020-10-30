"use strict";

class InvalidZone extends Error {
    constructor() {
        super('This zone is not supported by this device');
        //something
    }
}

module.exports = InvalidZone;
