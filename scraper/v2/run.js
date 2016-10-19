var watch = require('node-watch');
var path = require('path');
var fs = require('fs');
var unique = require('array-unique');
var async = require('async');
var debounce = require('debounce');
var mkdirp = require('mkdirp');
var clear = require('clear');
var request = require('request');

var writer = require('../writer');
var fetch = require('./fetch');

var notificationsPath = path.join(__dirname, '/../../dist/data/notifications');
var commentsPath = path.join(__dirname, '/../../dist/data/comments');
//var cachePath = path.join(__dirname, '/../../dist/data/cache');

var dump = require('../lib/dump');
var getEvenementMetadata = require('../lib/getEvenementMetadata');

var options = require('../options.json');
var getEvent = require('../lib/getEvent');
var broadcast = require('../../socket/server');
var exec = require('../lib/exec')(broadcast);


var events = [];
var commentsMap = [];
var lockedNotifications = [];

var lockedMatches = [];
var lastNotification = new Date();

var lastTick = new Date();
var TICK_TIMEOUT = 1000 * 60 * 2;

var noop = function () {

};


function createScoreboards(cb) {
    async.eachOf(options.clients, function (client, clientId, clientCb) {
        exec.scoreboard(clientId, clientCb);
    }, cb || noop);
}

function createScoreboardsWithEvent(eventId, cb) {
    async.eachOf(options.clients, function (client, clientId, clientCb) {
        if (client.evts.indexOf(eventId) > -1) {
            exec.scoreboard(clientId, clientCb);
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
            exec.match(parts[0], parts[1], parts[2], matchCb);
        }, cb);
    });
}

/**
 * Mise à jour autonome des données
 */
function tick(cb) {
    lastTick = new Date();
    cb = cb || noop;
    eachEvent(function (evt, eventCb) {
        exec.event(evt.id, evt.lang, eventCb);
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


function invalidateMatch(eventId, matchId, cb) {
    eachEvent(function (evt, eventCb) {
        if (evt.id != eventId) {
            return eventCb();
        }
        exec.match(evt.id, matchId, evt.lang, eventCb);
    }, cb);
}

function invalidateEvent(eventId, cb) {
    eachEvent(function (evt, eventCb) {
        if (evt.id != eventId) {
            return eventCb();
        }
        exec.event(evt.id, evt.lang, eventCb);
    }, function () {
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

function lang(locale) {
    var map = {
        fr: 1,
        en: 2,
        es: 3
    };

    return map[locale];
}

function watchForComments() {
    watch(commentsPath, {
        followSymLinks: true,
        recursive: true
    }, function (filename) {
        var find = filename.match(/comments\/(\w+)\/(\w+)\/xml\/(\w+)\/comments\/commentslive-(\w+)-(\w+)\.xml$/);
        if (find === null) {
            return;
        }
        var sport = find[1];
        var competition = find[2];
        var locale = find[3];
        var matchId = find[5];

        exec.match(getEventId(sport, competition), matchId, lang(locale), function () {
            broadcast('comments', matchId);
        });
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

function getEventId(discipline, codeFTP) {
    var id = null;
    commentsMap.forEach(function (item) {
        if (item.discipline === discipline && item.codeFTP === codeFTP) {
            id = item.eventId;
        }
    });
    return id;
}

function clock() {
    setInterval(tick, TICK_TIMEOUT);
    tick();
    //tick(function () {
    //    setTimeout(clock, TICK_TIMEOUT)
    //});
}

function createEventsFromOptions(cb) {

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
            });

        }
    }
    unique(events);
    events = events.map(parseKey);
    cb();
}


function writeClientsEvents(cb) {
    async.forEachOf(options.clients, function (client, clientId, clientCb) {
        console.info(clientId);
        var clientEvents = [];
        async.forEachOf(client.evts, function (id, index, eventCb) {
            getEvent(id, client.lang, function (event) {
                clientEvents[index] = {
                    id: event.id,
                    label: event.label,
                    country: event.country,
                    gender: event.gender,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    type: event.type
                };
                eventCb();
            });
        }, function () {
            writer('clients/' + clientId + '/competitions', clientEvents, clientCb);
        });
    }, cb);
}
function run() {
    async.series([
        createEventsFromOptions,
        writeClientsEvents
    ], function () {
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
    });
}


var createOptions = require('./createOptions');

createOptions(function(opts){
    options = opts;
    run();
});

(function (log) {
    if (log) {
        setInterval(function () {
            clear();
            console.info('lastNotif', lastNotification);
            console.info('lastTick', lastTick);
            console.info('\nSTATE', exec.log());
        }, 2000)
    }
})(true);
