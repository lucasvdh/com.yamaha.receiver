'use strict';

const http = require('http');
const et = require('elementtree');
const concat = require('concat-stream');
const Config = require('./Config');
// const Event = require('./Event');
const Log = require('../Log');

class EventServer {

    constructor(serverAddress, serverPort = null, onEventCallback = null) {
        this.serverAddress = serverAddress;
        this.serverPort = (serverPort === null) ? Config.port : serverPort;
        this.onEventCallback = onEventCallback;
        this.subscriptions = [];

        this.init();
    }

    init() {
        this.server = http.createServer((req, res) => {

            req.pipe(concat((buf) => {
                var sid = req.headers['sid'];
                var seq = req.headers['seq'];
                var events = this.parseEvents(buf);

                console.log('received events', sid, seq, events);

                var keys = Object.keys(this.subscriptions);
                var sids = keys.map((key) => {
                    return this.subscriptions[key].sid;
                })

                var idx = sids.indexOf(sid);
                if (idx === -1) {
                    // silently ignore unknown SIDs
                    return;
                }

                var serviceId = keys[idx];
                var listeners = this.subscriptions[serviceId].listeners;

                // Dispatch each event to each listener registered for
                // this service's events
                events.forEach((e) => {
                    this.onEvent(e);
                });
            }));

        });

        this.server.listen(this.serverPort, this.serverAddress);

        this.server.on('listening', () => {
            console.log('UPnP Event Server started listening');
        });
    }

    parseEvents(buf) {
        var events = [];
        var doc = et.parse(buf.toString());

        var lastChange = doc.findtext('.//LastChange');
        if (lastChange) {
            // AVTransport and RenderingControl services embed event data
            // in an `<Event></Event>` element stored as an URIencoded string.
            doc = et.parse(lastChange);

            // The `<Event></Event>` element contains one `<InstanceID></InstanceID>`
            // subtree per stream instance reporting its status.
            var instances = doc.findall('./InstanceID');
            instances.forEach(function (instance) {
                var data = {
                    InstanceID: Number(instance.get('val'))
                };
                instance.findall('./*').forEach(function (node) {
                    data[node.tag] = node.get('val');
                });
                events.push(data);
            });
        } else {
            // In any other case, each variable is stored separately in a
            // `<property></property>` tag
            var data = {};
            doc.findall('./property/*').forEach(function (node) {
                data[node.tag] = node.text;
            });
            events.push(data);
        }

        return events;
    }

    setOnEventCallback(onEventCallback) {
        this.onEventCallback = onEventCallback;
    }

    setOnErrorCallback(onErrorCallback) {
        this.onErrorCallback = onErrorCallback;
    }

    setPort(unicastPort) {
        this.unicastPort = unicastPort;
        this.rebind();
    }

    onEvent(event) {
        if (typeof this.onEventCallback === 'function') {
            this.onEventCallback(event);
        }
    }

    onError(error) {
        Log.captureException(error);

        if (typeof this.onErrorCallback === 'function') {
            this.onErrorCallback(error);
        }
    }

    rebind() {
        this.socket.close();
        this.init();
    }

    stop() {
        this.socket.close();
    }
}

module.exports = EventServer;