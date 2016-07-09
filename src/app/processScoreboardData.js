var $ = require('jquery');
var moment = require('moment');

module.exports = function (data) {
    var scoreboard = {
        competitions: data.competitions,
        upcomingDateList: [],
        upcomingMatches: {},
        pastDateList: [],
        pastMatches: {}
    };
    var now = new Date().toISOString();
    var nowDate = now.substr(0, 10);
    var nowTime = now.substr(11, 5);

    var matchesByDateAndCompetition = {};

    $.each(data.dates, function (date, matches) {

        if (date > nowDate) {
            scoreboard.upcomingDateList.push(date);
        } else if (date < nowDate) {
            scoreboard.pastDateList.push(date);
        }

        if (typeof matchesByDateAndCompetition[date] === 'undefined') {
            matchesByDateAndCompetition[date] = {};
        }

        $(matches).each(function (i, match) {
            if (typeof matchesByDateAndCompetition[date][match.competition] === 'undefined') {
                matchesByDateAndCompetition[date][match.competition] = [];
            }

            var winner;

            if (typeof match.home.penaltyShootoutScore !== 'undefined') {
                winner = (match.home.penaltyShootoutScore > match.away.penaltyShootoutScore) ? 'home' : 'away';
            } else if (typeof match.home.goals !== 'undefined') {
                winner = (match.home.goals > match.away.goals) ? 'home' : 'away';
            }

            if (winner) {
                match[winner].winner = true;
            }
            matchesByDateAndCompetition[date][match.competition].push(match);
        });

        $.each(matchesByDateAndCompetition[date], function (competition, matches) {
            matches.sort(function (a, b) {
                return a.time < b.time;
            });
        });
    });

    if (scoreboard.upcomingDateList.length > 5) {
        scoreboard.upcomingDateList.sort().length = 5;
    }

    if (scoreboard.pastDateList.length > 5) {
        scoreboard.pastDateList.sort().reverse().length = 5;
    }

    $(scoreboard.upcomingDateList).each(function (i, date) {
        scoreboard.upcomingMatches[date] = matchesByDateAndCompetition[date];
    });
    $(scoreboard.pastDateList).each(function (i, date) {
        scoreboard.pastMatches[date] = matchesByDateAndCompetition[date];
    });

    return scoreboard;
};