var fs = require('fs');
var async = require('async');
var getEvent = require('../lib/getEvent');
var writer = require('../writer');
var options = require('./options');

function run(clientId) {
    return new Promise(function (resolve) {

        var client = options.clients[clientId] || {};
        var clientLang = client.lang;
        var clientEvents = client.evts;
        var scoreboard = {dates: {}, competitions: {}};

        async.each(clientEvents, function (eventId, eventCb) {
            getEvent(eventId, clientLang, function (err, competition) {
                if (err) return eventCb();
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
            var d;
            for (d in scoreboard.dates) {
                if (scoreboard.dates.hasOwnProperty(d)) {
                    scoreboard.dates[d].sort(function (a, b) {
                        return new Date(a.date) - new Date(b.date);
                    });
                }
            }
            writer('clients/' + clientId + '/scoreboard', scoreboard, function () {
                console.info('$$SCOREBOARD', clientId);
                resolve();
            });
        });
    });
}


if (process.argv.length > 2) {
    run(process.argv[2]);
}

module.exports = run;