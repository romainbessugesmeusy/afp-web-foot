var exec = require('../lib/exec');
var broadcast = require('./broadcast');
var options = require('./options');
module.exports = function (filename) {

    var find = filename.match(/comments\/(\w+)\/(\w+)\/xml\/(\w+)\/comments\/commentslive-(\w+)-(\w+)\.xml$/);
    if (find === null) {
        return;
    }

    var sport = find[1];
    var competition = find[2];
    var locale = find[3];
    var matchId = find[5];
    var eventId = options.eventForSportAndCode(sport, competition);
    var langId = options.langIdForLocale(locale);

    if (typeof eventId === 'undefined') {
        return;
    }

    exec.match({event: eventId, match: matchId, lang: langId}, function () {
        broadcast('comments', {match: matchId, lang: lang(locale)});
    });
};