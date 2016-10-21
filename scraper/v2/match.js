var match = {event: process.argv[2], id: process.argv[3]};
var lang = process.argv[4] || '1';
var localeMap = {
    1: 'fr',
    2: 'en',
    3: 'es',
    108: 'br',
    136: 'de'
};
var locale = localeMap[lang];


var dump = require('../lib/dump');

var async = require('async');
var util = require('util');
var extend = require('extend');
var path = require('path');

var fetch = require('./fetch');
var writer = require('../writer');
var parseCommentFile = require('../lib/parseCommentFile');
var processComments = require('../lib/processComments');
var getEvenementMetadata = require('../lib/getEvenementMetadata');
var createLightMatch = require('../lib/createLightMatch');

function getEvenement(cb) {
    fetch('aaevenementinfo/:lang/:id', {id: match.event, lang: lang}, function (err, evenement) {
        match.competition = {
            id: evenement.Id,
            date: match.Date,
            label: evenement.Label,
            country: evenement.CountryIso,
            code: getEvenementMetadata(evenement, 'EDFTP'),
            sport: evenement.DisciplineCode
        };
        cb();
    });
}

function getMatchDetail(cb) {
    fetch('xcmatchdetail/:lang/:id', {id: match.id, lang: lang}, function (err, matchDetail) {
        extend(match, matchDetail);
        cb();
    }, fetch.INVALIDATE);
}

function getMatchComments(cb) {
    var filename = path.join(
        __dirname,
        '../../dist/data/comments',
        match.competition.sport,
        match.competition.code,
        'xml',
        locale,
        'comments/commentslive-' + locale + '-' + match.id + '.xml'
    );

    parseCommentFile(filename, function (comments) {
        match.Comments = comments;
        cb();
    });
}

function processMatch() {
    match.Arbitres = match.Arbitres || [];
    match.Events = match.Events || [];

    var data = {
        now: new Date(),
        id: match.Id,
        status: match.StatusCode,
        time: match.Minute || '0',
        date: match.Date,
        competition: match.competition,
        referees: match.Arbitres.map(processMatchReferee),
        periods: match.Periods.map(processMatchPeriod),
        events: match.Events.map(processMatchEvent),
        penaltyShootouts: processPenaltyShootouts(),
        stadium: {
            id: match.Stadium.Id,
            name: match.Stadium.Name,
            city: match.Stadium.CityName,
            country: match.Stadium.CountryIso
        },
        phase: {
            //type: phase.PhaseCompetCode
        },
        home: processTeam('Home'),
        away: processTeam('Away')

        /*,
         raw: match*/
    };

    processComments(data, match);

    return data;
}

function processMatchPeriod(period) {
    return {
        code: period.PeriodCode,
        home: period.HomeRes,
        away: period.AwayRes,
        time: period.TotalTime
    };
}

function processMatchReferee(arbitre) {
    return {
        role: arbitre.PositionCode,
        country: arbitre.CountryIso,
        name: arbitre.LomgName || arbitre.LongName
    }

}
function processMatchEvent(evt) {
    var event = {
        time: evt.Minute,
        period: evt.PeriodCode,
        players: [],
        type: evt.TypeEvtCode,
        side: (evt.TeamId === match.Home.TeamId) ? 'home' : 'away'
    };

    if (evt.PlayerId1) {
        event.players.push(evt.PlayerId1);
    }
    if (evt.PlayerId2) {
        event.players.push(evt.PlayerId2);
    }
    if (evt.PlayerId3) {
        event.players.push(evt.PlayerId2);
    }
    return event;

}

function processPenaltyShootouts() {
    if (!Array.isArray(match.Tabs)) {
        return null;
    }
    var ret = {home: [], away: []};

    match.Tabs.forEach(function (tabEvent) {
        var side = (tabEvent.TeamId === match.Home.TeamId) ? 'home' : 'away';
        var shootout = {
            player: tabEvent.PlayerId,
            number: tabEvent.Order
        };

        if (tabEvent.TypeEvtCode === 'VTTAX') {
            shootout.missed = tabEvent.ExtTypeEvtCode;
        }
        ret[side].push(shootout);
    });

    if (ret.home.length + ret.away.length === 0) {
        return null;
    }

    return ret;
}


function processTeam(side) {
    if (typeof match[side] === 'undefined' || match[side].TeamId === 0) {
        return {};
    }
    var teamDetail = {
        id: match[side].TeamId,
        name: match[side].TeamName,
        goals: match[side].TeamScore,
        penaltyShootoutGoals: match[side].TeamTabScore,
        qualified: match[side].TeamStatusCode === 'PAWIN'
    };

    if (teamDetail.penaltyShootoutGoals < 0 || teamDetail.penaltyShootoutGoals === null) {
        delete teamDetail.penaltyShootoutGoals;
    }

    if (teamDetail.goals > 0) {
        teamDetail.scorers = [];
        match.Events.forEach(function (event) {
            if (event.TeamId === teamDetail.id && (event.TypeEvtCode === 'VTBUT' || event.TypeEvtCode === 'VTPEN')) {
                teamDetail.scorers.push({
                    time: event.Minute,
                    player: event.PlayerId1,
                    penalty: event.TypeEvtCode === 'VTPEN'
                })
            }
        });
        teamDetail.scorers.reverse()
    }

    extend(teamDetail, getTeamStaff(match[side]));
    return teamDetail;
}


function transformPlayerInfoFromCompo(player) {
    return {
        id: player.Id,
        name: player.ShortName,
        fullname: player.LomgName || player.LongName,
        number: player.Bib,
        position: player.PositionCode,
        events: []
    }
}

function getTeamStaff(team) {

    var playerEvents = {};
    var playerEventTypes = ['VTJAU', 'VTBUT', 'VTROU'];
    match.Events.forEach(function (event) {
        if (playerEventTypes.indexOf(event.TypeEvtCode) > -1) {
            if (typeof playerEvents[event.PlayerId1] === 'undefined') {
                playerEvents[event.PlayerId1] = [];
            }
            playerEvents[event.PlayerId1].push({type: event.TypeEvtCode, minute: event.Minute});
        }
    });

    var ret = {
        staff: [],
        players: [],
        subs: []
    };

    var playersInCompo = {};
    team.TeamCompo.forEach(function (player) {
        playersInCompo[player.Id] = player;
    });

    team.TeamCompo.forEach(function (teamPlayer) {
        if (teamPlayer.Line === 0) {
            if (teamPlayer.PositionCode !== 'PSENT') {
                ret.subs.push(transformPlayerInfoFromCompo(teamPlayer));
            } else {
                ret.staff.push(transformPlayerInfoFromCompo(teamPlayer));
            }
        } else {
            if (typeof ret.players[teamPlayer.Line] === 'undefined') {
                ret.players[teamPlayer.Line] = {
                    line: teamPlayer.PositionCode,
                    players: []
                }
            }
            ret.players[teamPlayer.Line].players.push(transformPlayerInfoFromCompo(teamPlayer))
        }
    });
    ret.players.shift();
    ret.players.reverse();
    return ret;
}
function getLiveMatch(cb) {
    fetch('xclivematch/:lang/:id', {id: match.id}, function (err, livematch) {
        var away = extend({}, match.Away);
        away.TeamNbYellowCards = livematch.Away.TeamNbYellowCards;
        away.TeamNbRedCards = livematch.Away.TeamNbRedCards;

        var home = extend({}, match.Home);
        home.TeamNbYellowCards = livematch.Home.TeamNbYellowCards;
        home.TeamNbRedCards = livematch.Home.TeamNbRedCards;

        extend(match, livematch);
        match.Away = away;
        match.Home = home;
        cb();
    }, fetch.INVALIDATE);
}

function run() {
    async.series([
        getEvenement,
        getMatchDetail,
        getLiveMatch,
        getMatchComments
    ], function () {
        var processedMatch = processMatch();
        writer('matches/' + processedMatch.id + '_' + lang, processedMatch, function () {
            process.stdout.write('$$');
            process.stdout.write(JSON.stringify(createLightMatch(match.competition, '', match)));
            process.exit();
        });
    });
}

run();