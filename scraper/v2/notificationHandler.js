var exec = require('../lib/exec');
var fs = require('fs');
var options = require('./options');
var path = require('path');

module.exports = function notificationHandler(filename) {
    console.info('\nNOTIFICATION', filename);
    fs.readFile(path.join(__dirname, '../dist/data/notifications/', filename), 'utf8', function (err, content) {
        var json;

        if (err) return;

        try {
            json = JSON.parse(content);
        } catch (err) {
            return;
        }

        fs.unlinkSync(filename);

        if (json && json.Citius && json.Citius.EvenementId) {
            var langs = options.langsForEvent(json.Citius.EvenementId);
            console.info('notif event', json.Citius.EvenementId, langs);
            langs.forEach(function (lang) {
                exec.event({event: json.Citius.EvenementId, lang: lang}, function () {
                    var clients = options.clientsForEvent(json.Citius.EvenementId, lang);
                    console.info('event done, generating scoreboard', clients);
                    exec.scoreboards({clients: clients});
                });
                if (json.Citius.MatchId) {
                    console.info('event done, generating match', {
                        event: json.Citius.EvenementId,
                        match: json.Citius.MatchId,
                        lang: lang
                    });
                    exec.match({event: json.Citius.EvenementId, match: json.Citius.MatchId, lang: lang})
                }
            });
        }
    });
};