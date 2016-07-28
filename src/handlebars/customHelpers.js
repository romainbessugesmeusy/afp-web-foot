var Handlebars = require('handlebars');
var moment = require('moment');
var constants = require('../app/constants');
var groupBy = require('handlebars-group-by');
var translations = require('../../dist/data/locale/fr.json');


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

Handlebars.registerHelper('relativeDate', function (date, format) {
    var now = moment(new Date().toJSON().slice(0, 10));
    format = format || 'dddd D MMM';
    date = moment(date, 'YYYY-MM-DD');
    var diff = now.diff(date, 'days');

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
            if (typeof format !== 'string') {
                format = (date.year() === now.year()) ? 'dddd D MMM' : 'D MMM YYYY';
            }
            return moment(date, 'YYYY-MM-DD').format(format);
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
    if (date && parseInt(date) !== 0) {
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

    if (team === null) {
        return teamId;
    }
    var ret = '<a href="/teams/' + team.id + '"><img src="/data/teams/' + team.id + '.png"/><span class="name">' + team.name + '</span></a>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('t', function (name, domainOrCount) {
    if (typeof domainOrCount === 'string') {
        name = domainOrCount + '.' + name;
    }

    return (typeof translations[name] !== 'undefined') ? translations[name] : name;
});

Handlebars.registerHelper('countryBlock', function (code) {
    var countryName = Handlebars.Utils.escapeExpression(translations['country.' + code]);
    var flag = '<img class="flag" src="/img/flags/flags_un/48/' + code + '.png" alt="' + countryName + '"/>';
    var name = '<span class="countryName">' + countryName + '</span>';
    var ret = '<div class="country block">' + flag + name + '</div>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('countryInline', function (code) {
    var countryName = Handlebars.Utils.escapeExpression(translations['country.' + code]);
    var flag = '<img class="flag" src="/img/flags/flags_un/48/' + code + '.png" alt="' + countryName + '"/>';
    var name = '<span class="countryName">' + countryName + '</span>';
    var ret = '<span class="country inline">' + flag + name + '</span>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('matchTime', function (match, options) {
    switch (match.status) {
        case constants.status.paused :
            return 'MI-TEMPS';
        case constants.status.finished :
            return 'TERMINÉ';
    }
    return match.minute ? match.minute : match.time;
});

Handlebars.registerHelper('competitionName', function (competitionId, options) {
    return options.data.root.competitions[competitionId].label
});

Handlebars.registerHelper('switch', function (value, options) {
    this._switch_value_ = value;
    this._switch_break_ = false;
    var html = options.fn(this);
    delete this._switch_break_;
    delete this._switch_value_;
    return html;
});

Handlebars.registerHelper('case', function (value, options) {
    var args = Array.prototype.slice.call(arguments);
    var options = args.pop();

    if (this._switch_break_ || args.indexOf(this._switch_value_) === -1) {
        return '';
    } else {
        if (options.hash.break === true) {
            this._switch_break_ = true;
        }
        return options.fn(this);
    }
});

Handlebars.registerHelper('default', function (options) {
    if (!this._switch_break_) {
        return options.fn(this);
    }
});

Handlebars.registerHelper('groupName', function (groupId, options) {
    return (options.data.root.groups[groupId]) ? options.data.root.groups[groupId].name : groupId;
});

Handlebars.registerHelper('ifGroupHasName', function (groupId, options) {
    return (options.data.root.groups[groupId].name) ? options.fn(this) : options.inverse(this);
});

module.exports = Handlebars;