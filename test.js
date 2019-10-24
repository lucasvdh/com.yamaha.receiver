'use strict';

const InputEnum = require('./lib/enums/InputEnum');

console.log(Object.values(InputEnum).map(value => {
    return {
        id: value,
        name: value
    };
}))

// let client = new YamahaReceiverClient('192.168.1.8', 'Main_Zone');
//
// let percentileVolume = 25,
//     decibelVolume = (((100 - (percentileVolume + 19.5)) * 10) * -1);
//
// console.log(client.decibelToPercentile(decibelVolume));
// console.log(client.percentileToDecibel(percentileVolume));
//
// client.setVolume(percentileVolume).then(state => {
//     console.log(state);
// });

// decibel -500
// percentage = 30.5