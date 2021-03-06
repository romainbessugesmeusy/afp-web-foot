var $ = require('jquery');
var sortByDate = require('./sortByDate');
var setMatchWinner = require('./setMatchWinner');
var highlightedTeams = [2829, 1819, 2694, 1585, 594];
var sortMatchesByDate = require('./sortMatchesByDate');

module.exports = function (data, options) {
    var startDate = new Date();
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
        } else {
            scoreboard.todaysMatches = {
                highlight: [],
                normal: []
            };

            matches.forEach(function (m) {
                m.competitionName = data.competitions[m.competition].label;
                if (highlightedTeams.indexOf(m.home.id) > -1 || highlightedTeams.indexOf(m.away.id) > -1) {
                    scoreboard.todaysMatches.highlight.push(m);
                } else {
                    scoreboard.todaysMatches.normal.push(m);
                }
            });

            while (scoreboard.todaysMatches.highlight.length < 4 && scoreboard.todaysMatches.normal.length > 0) {
                scoreboard.todaysMatches.highlight.push(scoreboard.todaysMatches.normal.pop());
            }

        }

        if (typeof matchesByDateAndCompetition[date] === 'undefined') {
            matchesByDateAndCompetition[date] = {};
        }

        $(matches).each(function (i, match) {
            if (typeof matchesByDateAndCompetition[date][match.competition] === 'undefined') {
                matchesByDateAndCompetition[date][match.competition] = [];
            }
            setMatchWinner(match);
            matchesByDateAndCompetition[date][match.competition].push(match);
        });

        $.each(matchesByDateAndCompetition[date], function (competition, matches) {
            matches.sort(function (a, b) {
                return a.time > b.time;
            });
        });
    });

    $(scoreboard.upcomingDateList).each(function (i, date) {
        scoreboard.upcomingMatches[date] = matchesByDateAndCompetition[date];
    });

    $(scoreboard.pastDateList).each(function (i, date) {
        scoreboard.pastMatches[date] = matchesByDateAndCompetition[date];
    });

    scoreboard.pastDateList.sort(sortByDate(false));
    scoreboard.pastDateList = scoreboard.pastDateList.map(wrapDates);
    scoreboard.pastDateList.reverse();
    scoreboard.upcomingDateList.sort(sortByDate(true));
    scoreboard.upcomingDateList = scoreboard.upcomingDateList.map(wrapDates);

    if (scoreboard.todaysMatches) {
        scoreboard.todaysMatches.highlight.sort(sortMatchesByDate);
        scoreboard.todaysMatches.normal.sort(sortMatchesByDate);
    }

    scoreboard.dates = data.dates;

    console.info('processed scoreboard data in', new Date() - startDate, 'ms', scoreboard);

    return scoreboard;
};


function wrapDates(date, index) {
    return {date: date};
}