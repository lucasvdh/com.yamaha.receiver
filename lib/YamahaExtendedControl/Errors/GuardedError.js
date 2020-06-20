"use strict";

class GuardedError extends Error {
    constructor() {
        super('Unable to control the device, maybe it\'s turned off?');
        //something
    }
}

module.exports = GuardedError;
