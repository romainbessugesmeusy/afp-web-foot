var pool = require('workerpool').pool(__dirname + '/../v2/workers');
var broadcast = require('../v2/broadcast');
var async = require("async");
var noop = function () {

};

var EXEC_TIMEOUT = 1000 * 60 * 2;

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
            processing: false,
            start: new Date().getTime()
        }
    }

    var job = state[type][id];

    if (typeof cb === 'function') {
        job.listeners.push(cb);
    }

    if (job.processing && new Date().getTime() - job.start < EXEC_TIMEOUT) {
        return false;
    }

    job.processing = true;
    job.start = new Date().getTime();

    console.info('EXEC', type, id);

    return true;
}

function freeResource(type, id) {
    if (typeof state[type][id] === 'undefined') {
        return false;
    }
    state[type][id].processing = false;
    state[type][id].listeners.forEach(function (listener) {
        listener();
    });
    state[type][id].listeners.length = 0;
}

function execEvent(params, cb) {
    var key = params.event + '_' + params.lang;
    if (registerHandler('event', key, cb) === false) {
        return;
    }

    pool.exec('event', [params.event, params.lang]).then(function () {
        console.info('EVENT FINISHED', params);
        freeResource('event', key);
    })
}

function execMatch(params, cb) {
    var k = params.match + '_' + params.lang;
    if (registerHandler('match', k, cb) === false) {
        return;
    }

    pool.exec('match', [params.event, params.match, params.lang]).then(function (stdout) {
        if (matchHistory[k] != stdout) {
            try {
                var json = JSON.parse(stdout.substr(stdout.indexOf('$$') + 2));
                json.now = new Date();
                json.lang = params.lang;
                broadcast('match', json);
                matchHistory[k] = stdout;
            } catch (err) {
                console.error('could not broadcast', stdout);
            }
        }

        freeResource('match', k);
    });
}

function execTeam(params, cb) {
    // cb();
}

function execScoreboard(clientId, cb) {
    if (registerHandler('scoreboard', clientId, cb) === false) {
        return;
    }
    pool.exec('scoreboard', [clientId]).then(function () {
        console.info('SCOREBOARD FINISHED', clientId);
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

function execScoreboards(options, cb) {
    async.each(options.clients, execScoreboard, cb || noop)
}


module.exports = {
    match: execMatch,
    event: execEvent,
    scoreboard: execScoreboard,
    scoreboards: execScoreboards,
    // team: execTeam,
    state: state,
    log: log
};