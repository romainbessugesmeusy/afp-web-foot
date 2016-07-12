var Handlebars = require('handlebars');
var moment = require('moment');
var constants = require('../app/constants');
//var helpers = require('handlebars-helpers')('comparison', {handlebars: Handlebars});
var groupBy = require('handlebars-group-by');

groupBy.register(Handlebars);

require('moment/locale/fr');

moment.locale('fr');
console.info(moment.locale());

Handlebars.registerHelper('each_competition', function (dateObject, date, options) {
    if (typeof dateObject === 'undefined') {
        console.error('dateObject is undefined');
        return '';
    }

    var ret = '';
    var competitionId;
    for (competitionId in dateObject[date]) {
        if (dateObject[date].hasOwnProperty(competitionId)) {
            ret += options.fn({
                matches: dateObject[date][competitionId],
                competition: options.data.root.competitions[competitionId]
            });
        }
    }

    return ret;
});

Handlebars.registerHelper('relativeDate', function (date, options) {
    var diff = moment(new Date().toJSON().slice(0, 10)).diff(moment(date, 'YYYY-MM-DD'), 'days');

    switch (diff) {
        case 1:
            return 'hier';
        case 2:
            return 'avant-hier';
        case 0:
            return 'aujourd\'hui';
        case -1:
            return 'demain';
        case -2:
            return 'après-demain';
        default :
            return moment(date, 'YYYY-MM-DD').format('dddd D MMMM');
    }
});

Handlebars.registerHelper('penaltyShooter', function (playerId, options) {
    var player = {};
    options.data.root.home.players.forEach(function (p) {
        if (p.id === playerId) {
            player = p;
        }
    });
    options.data.root.away.players.forEach(function (p) {
        if (p.id === playerId) {
            player = p;
        }
    });

    return new Handlebars.SafeString(Handlebars.partials['teamPlayer'](player, options));
});

Handlebars.registerHelper('matchTime', function (match, options) {
    if (match.status === constants.status.inProgress) {
        return match.time;
    }

    if (match.status === constants.status.finished) {
        return 'TERMINÉ';
    }

    return ''
});

Handlebars.registerHelper('ifEquals', function (a, b, opts) {
    if (a == b) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});

Handlebars.registerHelper('getCompoLineLabel', function (team, index, opts) {
    console.info(team.lines);
    return team.lines[team.lines.length - 1 - index].Label;
});
module.exports = Handlebars;