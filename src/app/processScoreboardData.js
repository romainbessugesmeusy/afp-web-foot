var $ = require('jquery');
var sortByDate = require('./sortByDate');
var setMatchWinner = require('./setMatchWinner');

module.exports = function (data, options) {

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

        if (date >= nowDate) {
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
    return scoreboard;
};


function wrapDates(date, index) {
    return {date: date};
}