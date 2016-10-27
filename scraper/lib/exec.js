var exec = require('child_process').exec;
var pool = require('workerpool').pool(__dirname + '/../v2/workers');

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

        if (state[type][id].processing === true) {
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
        //var cmd = 'node ' + __dirname + '/../v2/event.js ' + id + ' ' + lang;
        //exec(cmd, function (/*err, stdout, stderr*/) {
        //    freeResource('event', key);
        //});

        pool.exec('event', [id, lang]).then(function () {
            freeResource('event', key);
        })
    }

    function execMatch(eventId, id, lang, cb) {
        var k = id + '_' + lang;
        if (registerHandler('match', k, cb) === false) {
            return;
        }
        //var cmd = 'node ' + __dirname + '/../v2/match.js ' + eventId + ' ' + id + ' ' + lang;
        //console.info('EXEC', cmd);
        //exec(cmd, function (err, stdout) {

        pool.exec('match', [eventId, id, lang]).then(function (stdout) {
            if (matchHistory[k] != stdout) {
                try {
                    var json = JSON.parse(stdout.substr(stdout.indexOf('$$') + 2));
                    json.now = new Date();
                    broadcast('match', json);
                    matchHistory[k] = stdout;
                } catch (err) {
                    console.error('could not broadcast', stdout);
                }
            }

            freeResource('match', k);
        });
    }

    function execTeam(team, lang, cb) {
        var k = team.id + '_' + lang;
        if (registerHandler('team', k, cb) === false) {
            return;
        }

        var cmd = 'node ' + __dirname + '/../v2/team.js ' + JSON.stringify(team) + ' ' + lang;
        console.info('EXEC', cmd);
        exec(cmd, function (err, stdout) {
            freeResource('team', k);
        });

    }

    function execScoreboard(clientId, cb) {
        if (registerHandler('scoreboard', clientId, cb) === false) {
            return;
        }
        //var cmd = 'node ' + __dirname + '/../v2/scoreboard.js ' + clientId;
        //console.info('EXEC', cmd);
        //exec(cmd, function (err) {
        pool.exec('scoreboard', [clientId], function () {
            broadcast('scoreboard', clientId);
            freeResource('scoreboard', clientId);
        });
    }


    function log() {
        var out = '';
        for (var type in state) {
            if (state.hasOwnProperty(type)) {
                out += '\n[' + type + ']\n';
                for (var id in state[type]) {
                    if (state[type].hasOwnProperty(id)) {
                        if (state[type][id].listeners.length) {
                            out += id + ', ';
                        }
                    }
                }
            }
        }
        return out;
    }


    return {
        match: execMatch,
        event: execEvent,
        scoreboard: execScoreboard,
        team: execTeam,
        state: state,
        log: log
    }
};