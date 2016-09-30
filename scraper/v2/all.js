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
var dump = require('../lib/dump');
var options = require('../options');
var exec = require('../lib/exec')(function () {
});
var events = [];

var clientId = process.argv[2];
var matchProgress = 0;
var progressPercent = 0;

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
            exec.match(parts[0], parts[1], parts[2], function () {
                matchProgress++;
                progressPercent = Math.round(matchProgress / matches.length * 10000) / 100;
                clear();
                console.info(progressPercent.toString() + '%');
                matchCb();
            });
        }, cb);
    });
}


function getMatches(evt, cb) {
    getEvent(evt.id, evt.lang, function (event) {
        var matchesForEvent = [];
        event.matches.forEach(function (match) {
            matchesForEvent.push(evt.id + '_' + match.id + '_' + evt.lang);
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

function createEventsFromOptions() {

    function parseKey(key) {
        var parts = key.split('_');
        return {id: parts[0], lang: parts[1]}
    }

    // Create unique couples [event ID / lang]
    for (var cId in options.clients) {
        if (options.clients.hasOwnProperty(cId)) {

            if (typeof clientId === 'undefined' || clientId == cId) {
                var client = options.clients[cId];
                writer('clients/' + cId + '/config', client);
                client.evts.forEach(function (evt) {
                    events.push(evt + '_' + client.lang);
                });
            }
        }
    }
    unique(events);
    events = events.map(parseKey);
}


function run() {
    createEventsFromOptions();
    eachEvent(function (evt, eventCb) {
        exec.event(evt.id, evt.lang, eventCb);
    }, function () {
        createMatches(function () {
            console.info('done');
        });
    });
}

run();