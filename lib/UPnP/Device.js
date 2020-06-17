'use strict';

const http = require('http');
const parseUrl = require('url').parse;
const Homey = require('homey');
const Config = require('./Config');

const SUBSCRIPTION_TIMEOUT = 300;

class UPnPDevice extends Homey.Device {

    subscribe() {
        var options = parseUrl('http://192.168.1.8:8080/AVTransport/evt');
        var server = {
            address: '192.168.1.43',
            port: Config.port
        };

        options.method = 'SUBSCRIBE';
        options.headers = {
            'HOST': options.host,
            'USER-AGENT': [Config.os.name + '/' + Config.os.version, 'UPnP/1.1', Config.app.name + '/' + Config.app.version].join(' '),
            'CALLBACK': '<http://' + server.address + ':' + server.port + '/>',
            'NT': 'upnp:event',
            'TIMEOUT': 'Second-' + SUBSCRIPTION_TIMEOUT
        };

        var req = http.request(options, function (res) {
            if (res.statusCode !== 200) {
                var err = new Error('SUBSCRIBE error');
                err.statusCode = res.statusCode;
                self.releaseEventingServer();
                self.emit('error', err);
                return;
            }

            var sid = res.headers['sid'];
            var timeout = parseTimeout(res.headers['timeout']);

            function renew() {
                console.log('renew subscription to %s', serviceId);

                var options = parseUrl(service.eventSubURL);
                options.method = 'SUBSCRIBE';
                options.headers = {
                    'HOST': options.host,
                    'SID': sid,
                    'TIMEOUT': 'Second-' + SUBSCRIPTION_TIMEOUT
                };

                var req = http.request(options, function (res) {
                    if (res.statusCode !== 200) {
                        var err = new Error('SUBSCRIBE renewal error');
                        err.statusCode = res.statusCode;
                        // XXX: should we clear the subscription and release the server here ?
                        self.emit('error', err);
                        return;
                    }

                    var timeout = parseTimeout(res.headers['timeout']);

                    var renewTimeout = Math.max(timeout - 30, 30); // renew 30 seconds before expiration
                    console.log('renewing subscription to %s in %d seconds', serviceId, renewTimeout);
                    var timer = setTimeout(renew, renewTimeout * 1000);
                    self.subscriptions[serviceId].timer = timer;
                });

                req.on('error', function (err) {
                    self.emit('error', err);
                });

                req.end();
            }

            var renewTimeout = Math.max(timeout - 30, 30); // renew 30 seconds before expiration
            console.log('renewing subscription to %s in %d seconds', renewTimeout);
            var timer = setTimeout(renew, renewTimeout * 1000);

            this.subscriptions = {
                sid: sid,
                timer: timer,
            };

        });

        req.on('error', function (err) {
            // this.releaseEventingServer();
            // this.emit('error', err);
            console.log('on error', error);
        });

        req.end();
    }

    getUnicastPort() {
        return Config.port;
    }

}

function parseTimeout(header) {
    return Number(header.split('-')[1]);
}

module.exports = UPnPDevice;