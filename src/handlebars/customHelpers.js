var Handlebars = require('handlebars');
//var moment = window.moment;
var constants = require('../app/constants');
var groupBy = require('handlebars-group-by');
var $ = require('jquery');

var enforceLeadingZero = function (value) {
    return value < 10 ? '0' + String(value) : String(value);
};

var formatTime = function (date) {
    var d = new Date(date);
    if (d.getHours() + d.getMinutes() === 0) {
        return moment(d).format('DD/MM/YY')
    }
    return enforceLeadingZero(d.getHours()) + ':' + enforceLeadingZero(d.getMinutes());
};


var getRealTime = function (match) {
    if (typeof match.time === 'undefined') {
        return '';
    }
    var delta = moment().diff(match.now, 'minutes');
    var parts = match.time.replace('\'', '').split('+').map(function (part) {
        return parseInt(part);
    });

    if (parts.length > 1) {
        parts[1] += delta;
    } else {
        if (parts[0] < 46 && parts[0] + delta > 45) {
            parts[0] = 45;
            parts.push(parts[0] + delta - 45)
        } else if (parts[0] < 90 && parts[0] > 45 && parts[0] + delta > 90) {
            parts[0] = 90;
            parts.push(parts[0] + delta - 90)
        } else {
            parts[0] += delta;
        }
    }
    var time = parts.map(function (part) {
        return String(part) + '\'';
    }).join('+');

    return new Handlebars.SafeString('<span class="realMatchTime" data-now="' + match.now + '" data-time="' + match.time + '">' + time + '</span>');
};

groupBy.register(Handlebars);


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

Handlebars.registerHelper('relativeTime', function (date) {
    return formatTime(date);
});

Handlebars.registerHelper('ifTimeOfMatchIsDefined', function (opts) {
    var d = new Date(this.date);
    if (d.getHours() + d.getMinutes() !== 0) {
        return opts.fn(this);
    } else {
        return opts.inverse(this);
    }
});


Handlebars.registerHelper('absDate', function (date, format) {
    var now = moment(new Date().toJSON().slice(0, 10));
    format = format || 'dddd D MMM';
    date = moment(date, 'YYYY-MM-DD');
    if (typeof format !== 'string') {
        format = (date.year() === now.year()) ? 'dddd D MMM' : 'D MMM YYYY';
    }
    return moment(date, 'YYYY-MM-DD').format(format);
});


var relativeDate = function (date, format) {
    var now = moment(new Date().toJSON().slice(0, 10));
    format = format || 'dddd D MMM';
    date = moment(date, 'YYYY-MM-DD');
    var diff = now.diff(date, 'days');

    function defaultCase(){
        if (typeof format !== 'string') {
            format = (date.year() === now.year()) ? 'dddd D MMM' : 'D MMM YYYY';
        }
        return moment(date, 'YYYY-MM-DD').format(format);
    }

    switch (diff) {
        case 1:
            return translations['relativeDate.yesterday'] || defaultCase();
        case 2:
            return translations['relativeDate.beforeYesterday'] || defaultCase();
        case 0:
            return translations['relativeDate.today'] || defaultCase();
        case -1:
            return translations['relativeDate.tomorrow'] || defaultCase();
        case -2:
            return translations['relativeDate.afterTomorrow'] || defaultCase();
        default :
            return defaultCase();
    }
};


Handlebars.registerHelper('relativeDate', relativeDate);

Handlebars.registerHelper('penaltyShooter', function (playerId, options) {
    var player = options.data.root.playerHash[playerId];
    return new Handlebars.SafeString(Handlebars.partials['teamPlayer'](player, options));
});

Handlebars.registerHelper('matchPlayerName', function (playerId, options) {
    var player = options.data.root.playerHash[playerId];
    return player ? player.name : playerId;
});

// todo CSC
Handlebars.registerHelper('joinScorerGoals', function (goals) {
    var strings = goals.map(function (g) {
        return g.penalty ? g.time + ' <strong>P</strong>' : g.time;
    });
    return new Handlebars.SafeString('(' + strings.join(', ') + ')');
});

Handlebars.registerHelper('liveMatchTime', function (match, options) {
    if (match.status === constants.status.inProgress) {
        return getRealTime(match);
    }

    if (match.status === constants.status.finished) {
        return '—';
    }

    return formatTime(match.date);
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
    var ret = '<a href="/teams/' + team.id + '"><img class="logo" src="/data/teams/logos/' + team.id + '.png"/><span class="name">' + team.name + '</span></a>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('t', function (name, domainOrCount, defaultValue) {
    var translations = window.translations || {};
    var retDef = (typeof defaultValue === 'string') ? defaultValue : name;

    if (typeof domainOrCount === 'string') {
        name = domainOrCount + '.' + name;
    }

    if (typeof translations[name] === 'undefined') {
        console.info('/*translation*/', '"' + name + '":"' + retDef + '",');
        return retDef;
    }

    return translations[name];
});

Handlebars.registerHelper('countryBlock', function (code) {
    var countryName = Handlebars.Utils.escapeExpression(translations['country.' + code]);
    var flag = '<img class="flag" src="/data/flags/flags_un/48/' + code + '.png" alt="' + countryName + '"/>';
    var name = '<span class="countryName">' + countryName + '</span>';
    var ret = '<div class="country block">' + flag + name + '</div>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('countryInline', function (code) {
    var countryName = Handlebars.Utils.escapeExpression(translations['country.' + code]);
    var flag = '<img class="flag" src="/data/flags/flags_un/48/' + code + '.png" alt="' + countryName + '"/>';
    var name = '<span class="countryName">' + countryName + '</span>';
    var ret = '<span class="country inline">' + flag + name + '</span>';
    return new Handlebars.SafeString(ret);
});

Handlebars.registerHelper('matchTime', function (match, options) {
    switch (match.status) {
        case constants.status.upcoming :
            return '—';
        case constants.status.paused :
            return 'MI-TEMPS';
        case constants.status.finished :
            return 'TERMINÉ';
    }

    return getRealTime(match);

    //console.info(match.time, match.now, delta);
    //return match.minute ? match.minute : match.time;
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
    if (this._switch_break_ === false) {
        return options.fn(this);
    }
});

Handlebars.registerHelper('groupName', function (groupId, options) {
    return (options.data.root.groups[groupId]) ? options.data.root.groups[groupId].name : groupId;
});

Handlebars.registerHelper('ifGroupHasName', function (groupId, options) {
    return (options.data.root.groups[groupId].name) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('groupRanking', function (groupId, options) {
    var data = '';
    $(options.data.root.phases).each(function (i, phase) {
        if (phase.rankings && phase.rankings[groupId]) {
            data = new Handlebars.SafeString(Handlebars.partials['rankings'](phase.rankings[groupId], options));
        }
    });
    return data;
});

Handlebars.registerHelper('regularSeasonRankings', function (phase, options) {
    if (phase.rankings) {
        var groupId = Object.keys(phase.rankings)[0];
        return new Handlebars.SafeString(Handlebars.partials['rankings'](phase.rankings[groupId], options));
    }
    return '';
});

Handlebars.registerHelper('matchStatus', function (match, options) {
    if (match.status === constants.status.upcoming || match.status === constants.status.finished) {
        return relativeDate(match.date, 'dddd DD MMMM Y') + ' à ' + moment(match.date).format('H[h]mm');
    }
    return translations['const.' + match.status];
});

Handlebars.registerHelper('upper', function (str) {
    return str.toUpperCase();
})
module.exports = Handlebars;