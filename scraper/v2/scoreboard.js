var fs = require('fs');
var path = require('path');
var async = require('async');

var getEvent = require('../lib/getEvent');
var writer = require('../writer');

var clientId = process.argv[2];

fs.readFile(path.join(__dirname, '/../options.json'), 'utf8', function (err, content) {
    var options = JSON.parse(content);
    var client = options.clients[clientId] || {};
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
        var d;
        for (d in scoreboard.dates) {
            if (scoreboard.dates.hasOwnProperty(d)) {
                scoreboard.dates[d].sort(function (a, b) {
                    return new Date(a.date) - new Date(b.date);
                });
            }
        }

        writer('clients/' + clientId + '/scoreboard', scoreboard, function () {
            process.exit();
        });
    });
});