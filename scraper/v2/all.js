var unique = require('array-unique');
var async = require('async');
var writer = require('../writer');
var options = require('../options');
var getEvent = require('../lib/getEvent');
var exec = require('../lib/exec')(function () {
});

function run(clients) {

    var events = [];
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
                    //clear();
                    //console.info(progressPercent.toString() + '%');
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

    function createEventsFromOptions(clients) {

        function parseKey(key) {
            var parts = key.split('_');
            return {id: parts[0], lang: parts[1]}
        }

        // Create unique couples [event ID / lang]
        for (var cId in options.clients) {
            if (options.clients.hasOwnProperty(cId)) {

                if (clients.length === 0 || clients.indexOf(cId) > -1) {
                    var client = options.clients[cId];
                    client.evts.forEach(function (evt) {
                        events.push(evt + '_' + client.lang);
                    });
                }
            }
        }
        unique(events);
        events = events.map(parseKey);
    }

    return new Promise(function (resolve) {
        createEventsFromOptions(clients);
        createMatches(resolve);
    })
}

var createOptions = require('./createOptions');

if (process.argv.length > 2) {
    createOptions(function (opts) {
        options = opts;
        run(Array.prototype.slice.call(process.argv, 2));
    });
}

module.exports = run;