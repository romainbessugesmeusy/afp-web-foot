var watch = require('node-watch');
var path = require('path');
var fs = require('fs');
var unique = require('array-unique');
var async = require('async');
var debounce = require('debounce');
var mkdirp = require('mkdirp');
var clear = require('clear');

var writer = require('../writer');
var fetch = require('./fetch');

var notificationsPath = path.join(__dirname, '/../../dist/data/notifications');
var commentsPath = path.join(__dirname, '/../../dist/data/comments');
//var cachePath = path.join(__dirname, '/../../dist/data/cache');

var dump = require('../lib/dump');
var getEvenementMetadata = require('../lib/getEvenementMetadata');

var options = require('../options');
var exec = require('child_process').exec;


function execEvent(id, lang, cb) {
    var key = id + '_' + lang;
    if (registerHandler('event', key, cb) === false) {
        return;
    }
    delete eventsHash[key];
    var cmd = 'node ' + __dirname + '/event.js ' + id + ' ' + lang;
    exec(cmd, function () {
        freeResource('event', key);
    });
}

function execMatch(eventId, id, lang, cb) {
    var k = id + '_' + lang
    if (registerHandler('match', k, cb) === false) {
        return;
    }

    exec('node ' + __dirname + '/match.js ' + eventId + ' ' + id + ' ' + lang, function (err, stdout) {

        if (matchHistory[k] != stdout) {
            var json = JSON.parse(stdout.substr(stdout.indexOf('$$') + 2));
            json.now = new Date();
            broadcast('match', json);
            matchHistory[k] = stdout;
        }

        freeResource('match', k);
    });
}

var broadcast = require('../../socket/server');

var events = [];
var commentsMap = [];
var lockedNotifications = [];
var lockedMatches = [];

var lastNotification = new Date();
var lastScoreboardBuild = {};
var lastTick = new Date();

var matchHistory = {};

var TICK_TIMEOUT = 1000 * 60;
var EXEC_TIMEOUT = 1000 * 30;

var state = {
    scoreboard: {},
    match: {},
    event: {}
};

var noop = function () {

};

setInterval(function () {
    clear();
    console.info('lastNotif', lastNotification);
    console.info('lastScoreboardBuild', lastScoreboardBuild);
    console.info('lastTick', lastTick);

    console.info('\nSTATE', logState());
}, 1000);


function logState() {
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

function createScoreboard(clientId, client, cb) {

    if (registerHandler('scoreboard', clientId, cb) === false) {
        return;
    }

    var clientLang = client.lang;
    var clientEvents = client.evts;
    var scoreboard = {dates: {}, competitions: {}};
    async.each(clientEvents, function (eventId, eventCb) {
        getEvent(eventId, clientLang, function (competition) {
            scoreboard.competitions[eventId] = {
                id: competition.id,
                label: competition.label,
                country: competition.country
            };
            competition.matches.forEach(function (match) {
                match.now = new Date();
                var day = match.date.substring(0, 10);
                if (typeof scoreboard.dates[day] === 'undefined') {
                    scoreboard.dates[day] = []
                }
                scoreboard.dates[day].push(match);
            });
            eventCb();
        });
    }, function () {
        lastScoreboardBuild[clientId] = new Date();
        writer('clients/' + clientId + '/scoreboard', scoreboard, function () {
            broadcast('scoreboard', clientId);
            freeResource('scoreboard', clientId);
        });
    });
}

function createScoreboards(cb) {
    async.eachOf(options.clients, function (client, clientId, clientCb) {
        createScoreboard(clientId, client, clientCb);
    }, cb || noop);
}

function createScoreboardsWithEvent(eventId, cb) {
    async.eachOf(options.clients, function (client, clientId, clientCb) {
        if (client.evts.indexOf(eventId) > -1) {
            createScoreboard(clientId, client, clientCb);
        }
    }, cb || noop);
}

function createMatches(cb) {
    var matches = [];
    async.each(events, function (key, eventCb) {
        getMatches(key, function (list) {
            matches = matches.concat(list);
            eventCb();
        });
    }, function () {
        async.eachLimit(matches, 30, function (matchKey, matchCb) {
            var parts = matchKey.split('_');
            execMatch(parts[0], parts[1], parts[2], matchCb);
        }, cb);
    });
}

/**
 * Mise à jour autonome des données
 */
function tick(cb) {
    cb = cb || noop;
    eachEvent(function (evt, eventCb) {
        execEvent(evt.id, evt.lang, eventCb);
    }, function () {
        async.parallel([
            // dès que les événemens ont été rechargés
            // on a suffisamment de data pour construire les scoreboards
            createScoreboards,
            // en parallèle, on charge tous les matches susceptibles d'avoir bougé
            createMatches,
            //createTeamsAndPlayers,
        ], cb);
    });
}

function getMatches(evt, cb) {
    getEvent(evt.id, evt.lang, function (event) {
        var now = new Date();
        var matchesForEvent = [];
        event.matches.forEach(function (match) {
            var matchDate = new Date(match.date);
            var diff = (matchDate - now) / (1000 * 60 * 60 * 24);
            if (diff < 2 && diff > -1) {
                matchesForEvent.push(evt.id + '_' + match.id + '_' + evt.lang);
            }
        });
        cb(matchesForEvent);
    })
}


// Helpers
function eachEvent(callback, done) {
    async.eachLimit(events, 10, callback, done);
}

function parseJSON(string, debug) {
    var json;
    try {
        json = JSON.parse(string);
    } catch (err) {
        var errorMessage = debug || 'err parsing json';
        errorMessage += '\n> ' + string;
        console.error(errorMessage);
    }
    return json;

}


var eventsHash = {};

/**
 * Charge le contenu du fichier JSON et le passe au callback
 * Attention, il faut que le fichier existe
 * @param id
 * @param lang
 * @param cb
 */
function getEvent(id, lang, cb) {
    var key = id + '_' + lang;
    if (typeof eventsHash[key] === 'undefined') {
        fs.readFile(__dirname + '/../../dist/data/competitions/' + id + '_' + lang + '.json', 'utf8', function (err, content) {

            var json = parseJSON(content, 'getEvent(' + id + ',' + lang + ')\n Err:' + err + ')');
            if (err || typeof json === 'undefined') {
                return cb(eventsHash[key]);
            }
            eventsHash[key] = json;
            cb(json);
        });
    } else {
        return cb(eventsHash[key]);
    }
}

function pipeResults(cb, debug) {
    var called = false;
    setTimeout(function () {
        if (!called) {
            called = true;
            return cb();
        }
    }, EXEC_TIMEOUT);

    return function (err, stdout, stderr) {
        if (stdout) {
            console.info(stdout);
        }

        if (stderr) {
            console.error(stderr);
        }

        if (!called) {
            called = true;
            return cb();
        } else {
            console.info('TOO LATE MOTHERFUCKER', debug)
        }
    }
}

function invalidateMatch(eventId, matchId, cb) {
    eachEvent(function (evt, eventCb) {
        if (evt.id != eventId) {
            return eventCb();
        }
        execMatch(evt.id, matchId, evt.lang, eventCb);
    }, cb);
}

function invalidateEvent(eventId, cb) {
    eachEvent(function (evt, eventCb) {
        if (evt.id != eventId) {
            return eventCb();
        }
        execEvent(evt.id, evt.lang, eventCb);
    }, function () {
        broadcast('competition', {competition: eventId});
        createScoreboardsWithEvent(eventId);
        cb();
    });
}


function today() {
    var now = new Date(), m = now.getMonth() + 1, d = now.getDate();
    var today = now.getFullYear().toString();
    today += '-';
    today += m < 10 ? '0' + m : m;
    today += '-';
    today += d < 10 ? '0' + d : d;
    return today;
}


function archive(filename) {
    var archiveDir = path.join(notificationsPath, 'archive', today());
    mkdirp(archiveDir, function () {
        fs.rename(path.join(notificationsPath, filename), path.join(archiveDir, filename), function (err) {
            if (err) {
                return console.error(err);
            }
            lockedNotifications.splice(lockedNotifications.indexOf(filename), 1);
        });
    });
}


function parseNotifications(cb) {
    cb = noop;
    lastNotification = new Date();

    fs.readdir(notificationsPath, function (err, files) {

        async.eachLimit(files, 100, function (filename, fileCb) {

            if (lockedNotifications.indexOf(filename) !== -1) {
                return fileCb();
            } else {
                lockedNotifications.push(filename);
            }

            var find = filename.match(/([0-9]{8}T[0-9]{6})-([0-9]+)-([A-Z]+)\.json/);

            if (find === null) {
                archive(filename);
                return fileCb();
            }

            switch (find[3]) {
                case 'MATCH':
                    fs.readFile(path.join(notificationsPath, filename), 'utf8', function (err, content) {
                        archive(filename);
                        var notification;
                        try {
                            notification = JSON.parse(content);
                        } catch (err) {
                            notification = {};
                            return fileCb();
                        }

                        var pre = notification.Citius.Matches[0];
                        var post = notification.Citius.Matches[1];

                        if (pre.HomeScore === post.HomeScore
                            && pre.AwayScore === post.AwayScore
                            && pre.Status === post.Status) {
                            return fileCb();
                        }

                        if (lockedMatches.indexOf(notification.Citius.MatchId) !== -1) {
                            createScoreboardsWithEvent(notification.Citius.EvenementId, fileCb);
                            return fileCb();
                        } else {
                            lockedMatches.push(notification.Citius.MatchId);
                        }

                        async.parallel([
                            function (cb) {
                                invalidateEvent(notification.Citius.EvenementId, cb);
                            },
                            function (cb) {
                                invalidateMatch(
                                    notification.Citius.EvenementId,
                                    notification.Citius.MatchId,
                                    cb
                                );
                            }
                        ], function () {
                            lockedMatches.splice(lockedMatches.indexOf(notification.Citius.MatchId), 1);
                            fileCb();
                        });
                    });
                    break;
                case 'SCHEDULE':
                    invalidateEvent(find[2], fileCb);
                    archive(filename);
                    break;
                default:
                    return fileCb();
            }
        }, cb);
    });
}

var dParseNotifications = debounce(parseNotifications, 300);

function watchForNotifications() {
    watch(notificationsPath, {
        followSymLinks: true,
        recursive: false
    }, dParseNotifications);
}

function watchForComments() {
    watch(commentsPath, {
        followSymLinks: true,
        recursive: true
    }, function (filename) {
        var find = filename.match(/comments\/([A-Z0-9a-z]+)\/([A-Z0-9a-z]+)\/xml\/commentslive-([a-z]+)-([0-9]+)\.xml/)
        if (find !== null) {
            //todo something
        }

    });
}

/**
 * Méthode appelée au run() pour construire le dictionnaire
 * d'événements. On stocke ID, discipline et CodeFTP
 * @param evt
 * @param cb
 */
function getEventInfo(evt, cb) {

    fetch('aaevenementinfo/:lang/:id', evt, function (err, data) {
        commentsMap.push({
            eventId: data.Id,
            discipline: data.DisciplineCode,
            codeFTP: getEvenementMetadata(data, 'EDFTP')
        });
        cb();
    });
}

function clock() {
    setInterval(tick, TICK_TIMEOUT);
    tick();
    //tick(function () {
    //    setTimeout(clock, TICK_TIMEOUT)
    //});
}

function createEventsFromOptions() {

    function parseKey(key) {
        var parts = key.split('_');
        return {id: parts[0], lang: parts[1]}
    }

    // Create unique couples [event ID / lang]
    for (var clientId in options.clients) {
        if (options.clients.hasOwnProperty(clientId)) {

            var client = options.clients[clientId];
            writer('clients/' + clientId + '/config', client);

            client.evts.forEach(function (evt) {
                events.push(evt + '_' + client.lang);
            })
        }
    }
    unique(events);
    events = events.map(parseKey);
}


function run() {

    createEventsFromOptions();

    // On récupère les infos des événements pour reconstituer
    // le chemin vers les commentaires XML.
    // On a besoin de la discipline et de la valeur EDFTP
    // Une fois que le dictionnaire des événements est constitué
    // on peut commencer à inspecter le dossier des commentaires
    async.each(events, getEventInfo, watchForComments);

    // Pas besoin d'attendre pour regarder le dossier des notifications
    watchForNotifications();

    // On démarre le "cron" qui va regénérer les événements toutes les X min
    clock();
}

run();