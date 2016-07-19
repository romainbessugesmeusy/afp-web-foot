var $ = require('jquery');
var defaults = {
    displayedDays: 5,
    upcomingMatchesOffset: 0,
    pastMatchesOffset: 0
};

module.exports = function (data, options) {

    options = $.extend({}, defaults, options);

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

    function sortByDate(asc) {
        return function (a, b) {
            var arrayValuesToInt = function (part) {
                return parseInt(part)
            };
            var pa = a.split('-').map(arrayValuesToInt);
            var pb = b.split('-').map(arrayValuesToInt);
            var up = (asc) ? pa : pb;
            var low = (asc) ? pb : pa;

            if (up[0] !== low[0]) {
                return up[0] - low[0]
            }

            if (up[1] !== low[1]) {
                return up[1] - low[1];
            }

            if (up[2] !== low[2]) {
                return up[2] - low[2];
            }

            return 0;
        }
    }

    scoreboard.pastDateList.sort(sortByDate(false));
    scoreboard.pastDateList = scoreboard.pastDateList.map(wrapDates(options.pastMatchesOffset, options.displayedDays));
    scoreboard.pastDateList.reverse();
    scoreboard.upcomingDateList.sort(sortByDate(true));
    scoreboard.upcomingDateList = scoreboard.upcomingDateList.map(wrapDates(options.upcomingMatchesOffset, options.displayedDays));
    return scoreboard;
};


function wrapDates(offset, displayedDays){
    return function(date, index){
        var obj = {date: date};
        if (index < offset ) {
            obj.className = 'prev';
        } else if (index >= offset + displayedDays) {
            obj.className = 'next';
        } else {
            obj.className = 'current';
        }
        return obj;
    }
}