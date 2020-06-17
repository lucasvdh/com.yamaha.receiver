'use strict';

class UnicastEvent {

    constructor(data) {
        this.data = data;
    }

    hasSystemInfo() {
        return this.getSystemInfo() !== null;
    }

    hasZoneInfo() {
        return this.getZoneInfo() !== null;
    }

    hasTunerInfo() {
        return this.getTunerInfo() !== null;
    }

    hasNetUSBInfo() {
        return this.getNetUSBInfo() !== null;
    }

    hasCDInfo() {
        return this.getCDInfo() !== null;
    }

    hasDistInfo() {
        return this.getDistInfo() !== null;
    }

    hasClockInfo() {
        return this.getClockInfo() !== null;
    }

    getDeviceId() {
        return this.data.device_id;
    }

    getSystemInfo() {
        return this.data.system || null;
    }

    getZoneInfo() {
        let zones = [
            'main',
            'zone2',
            'zone3',
            'zone4',
        ];

        for (let i in zones) {
            if (typeof this.data[zones[i]] !== "undefined") {
                return this.data[zones[i]];
            }
        }

        return null;
    }

    getTunerInfo() {
        return this.data.tuner || null;
    }

    getNetUSBInfo() {
        return this.data.netusb || null;
    }

    getCDInfo() {
        return this.data.cd || null;
    }

    getDistInfo() {
        return this.data.dist || null;
    }

    getClockInfo() {
        return this.data.clock || null;
    }

}

module.exports = UnicastEvent;