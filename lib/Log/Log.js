'use strict';

const Sentry = require('@sentry/node');

class Log {

    constructor(homey) {

        this._capturedExceptions = [];
        this._capturedMessages = [];

        this._homey = homey;

        if (typeof this._homey === 'undefined')
            return console.error('Error: Homey not found');

        if (typeof this._homey.env.HOMEY_LOG_URL === 'string') {
            this.init(this._homey.env.HOMEY_LOG_URL);
        }
    }

    _log() {
        console.log.bind(null, Log.logTime(), '[homey-log]').apply(null, arguments);
    }

    init(url) {

        if (process.env.DEBUG === '1' && this._homey.env.HOMEY_LOG_FORCE !== '1')
            return this._log('App is running in debug mode, disabling log');

        Sentry.init({
            dsn: url,
            release: 'homey-yamaha@' + this._homey.manifest.version
        });

        this.setTags({
            homeyVersion: this._homey.version,
            appVersion: this._homey.manifest.version,
        });

        if (this._homey.hasOwnProperty('ManagerCloud')) { // SDKv2
            this._homey.ManagerCloud.getHomeyId(this.setHomeyIdTag.bind(this))
        }

        if (this._homey.hasOwnProperty('ManagerI18n')) { // SDKv2
            this.setTags({
                lang: this._homey.ManagerI18n.getLanguage(),
            });
        }

        this._log(`App ${this._homey.manifest.id} v${this._homey.manifest.version} logging...`);

        return this;

    }

    setHomeyIdTag(err, result) {
        if (!err && typeof result === 'string') {
            Sentry.setUser({id: result});
            this.setTags({homeyId: result})
        }
    }

    setTags(tags) {
        Sentry.configureScope(scope => {
            for (let name in tags) {
                let value = tags[name];

                scope.setTag(name, value);
            }
        });

        return this;
    }

    setExtra(extra) {
        Sentry.configureScope(scope => {
            for (let name in extra) {
                let value = extra[name];

                scope.setExtra(name, value);
            }
        });

        return this;
    }

    setUser(user) {
        Sentry.configureScope(scope => {
            scope.setUser(user);
        });

        return this;
    }

    addBreadcrumb(category, message, data, level = Sentry.Severity.Info) {
        Sentry.addBreadcrumb({
            category: category,
            level: level,
            message: message,
            data: data,
        });

        return this;
    }

    /*
export interface Breadcrumb {
    type?: string;
    level?: Severity;
    event_id?: string;
    category?: string;
    message?: string;
    data?: {
        [key: string]: any;
    };
    timestamp?: number;
}

.addBreadcrumb({
    category: 'console',
    level: sentryLevel,
    message: util.format.apply(undefined, arguments),
}, {
    input: tslib_1.__spread(arguments),
    level: level,
})
     */

    captureMessage(message, preventDuplicates = true) {
        this._log('captureMessage:', message);

        if (this._capturedMessages.indexOf(message) > -1 && preventDuplicates === true) {
            this._log('Prevented sending a duplicate message');
            return this;
        }

        this._capturedMessages.push(message);

        Sentry.captureMessage(message);

        return this;
    }

    captureException(err, preventDuplicates = true) {
        this._log('captureException:', err);

        if (this._capturedExceptions.indexOf(err) > -1 && preventDuplicates === true) {
            this._log('Prevented sending a duplicate log');
            return this;
        }

        this._capturedExceptions.push(err);

        Sentry.captureException(err);

        return this;
    }

    static logTime() {
        let date = new Date();

        let mm = date.getMonth() + 1;
        mm = (mm < 10 ? "0" + mm : mm);
        let dd = date.getDate();
        dd = (dd < 10 ? "0" + dd : dd);
        let hh = date.getHours();
        hh = (hh < 10 ? "0" + hh : hh);
        let min = date.getMinutes();
        min = (min < 10 ? "0" + min : min);
        let sec = date.getSeconds();
        sec = (sec < 10 ? "0" + sec : sec);

        return `${date.getFullYear()}-${mm}-${dd} ${hh}:${min}:${sec}`;
    }
}

module.exports = new Log();
