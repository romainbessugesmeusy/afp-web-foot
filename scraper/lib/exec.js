var exec = require('child_process').exec;

module.exports = function (broadcast) {

    var state = {
        scoreboard: {},
        match: {},
        event: {}
    };

    var matchHistory = {};

    function registerHandler(type, id, cb) {
        if (typeof state[type][id] === 'undefined') {
            state[type][id] = {
                listeners: [],
                processing: false
            }
        }

        state[type][id].listeners.push(cb);
        if (state[type][id].processing) {
            return false;
        }
        state[type][id].processing = true;
        return true;
    }

    function freeResource(type, id) {
        if (typeof state[type][id] === 'undefined') {
            console.error('undefined resource', type, id);
            return false;
        }
        state[type][id].processing = false;
        state[type][id].listeners.forEach(function (listener) {
            listener();
        });
        state[type][id].listeners.length = 0;
    }

    function execEvent(id, lang, cb) {
        var key = id + '_' + lang;
        if (registerHandler('event', key, cb) === false) {
            return;
        }
        var cmd = 'node ' + __dirname + '/event.js ' + id + ' ' + lang;
        exec(cmd, function () {
            freeResource('event', key);
        });
    }

    function execMatch(eventId, id, lang, cb) {
        var k = id + '_' + lang;
        if (registerHandler('match', k, cb) === false) {
            return;
        }

        exec('node ' + __dirname + '/../v2/match.js ' + eventId + ' ' + id + ' ' + lang, function (err, stdout) {

            if (matchHistory[k] != stdout) {
                var json = JSON.parse(stdout.substr(stdout.indexOf('$$') + 2));
                json.now = new Date();
                broadcast('match', json);
                matchHistory[k] = stdout;
            }

            freeResource('match', k);
        });
    }

    return {
        match: execMatch,
        event: execEvent,
        state: state
    }
};