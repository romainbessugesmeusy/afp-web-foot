var Handlebars = require('handlebars');
var moment = require('moment');
var constants = require('../app/constants');
var groupBy = require('handlebars-group-by');

groupBy.register(Handlebars);

require('moment/locale/fr');

moment.locale('fr');

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
            return moment(date, 'YYYY-MM-DD').format('dddd D MMM');
    }
});

Handlebars.registerHelper('penaltyShooter', function (playerId, options) {
    var player = options.data.root.playerHash[playerId];
    return new Handlebars.SafeString(Handlebars.partials['teamPlayer'](player, options));
});

Handlebars.registerHelper('matchPlayerName', function (playerId, options) {
    var player = options.data.root.playerHash[playerId];
    return player ? player.name : playerId;
});

Handlebars.registerHelper('joinScorerGoals', function (goals) {
    var strings = goals.map(function (g) {
        return g.penalty ? g.time + ' <strong>P</strong>' : g.time;
    });
    return new Handlebars.SafeString('(' + strings.join(', ') + ')');
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
    if (typeof team.lines === 'undefined') {
        return '';
    }

    if (typeof team.lines[index] === 'undefined') {
        return '';
    }

    return team.lines[index];
});
//
//Handlebars.registerHelper('getPlayer', function (team, playerId, opts) {
//    var player = {};
//    $(team.players).each(function (i, line) {
//        $(line).each(function (j, p) {
//            if (p.id === playerId) {
//                player = p;
//            }
//        });
//    });
//    return player;
//});
Handlebars.registerHelper('age', function (date, format) {
    if (date) {
        return Math.abs(moment(date, format).diff(moment(), 'years')) + ' ans';
    }
    return ''
});

Handlebars.registerHelper('teamCondensed', function (teamId, options) {
    var team = null;

    options.data.root.teams.forEach(function (t) {
        if (t.id === parseInt(teamId)) {
            team = t;
        }
    });
    var ret = '<a href="/teams/'+team.id+'"><img src="/data/teams/' + team.id + '.png"/><span class="name">' + team.name + '</span></a>';
    return new Handlebars.SafeString(ret);
});

module.exports = Handlebars;