var moment = require('moment');
var unique = require('array-unique');
module.exports = function processCompetitionData(data) {
    data.matchesMonths = [];
    data.daysOfCompetition = [];
    data.nearestDayOfCompetition = 1;
    var uniqueMonths = [];
    var lowestDateDiff = 1000;
    var dateDiff;
    var matchDate;
    var now = moment();
    data.matches.reverse();
    data.matches.forEach(function (match) {
        matchDate = moment(match.date);
        dateDiff = Math.abs(now.diff(matchDate, 'days'));
        if (dateDiff < lowestDateDiff) {
            lowestDateDiff = dateDiff;
            data.nearestDayOfCompetition = match.dayOfCompetition;
        }

        match.month = matchDate.format('YYYY-MM');
        data.daysOfCompetition.push(match.dayOfCompetition);
        if (uniqueMonths.indexOf(match.month) === -1) {
            data.matchesMonths.push({value: match.month, label: matchDate.format('MMMM')});
            uniqueMonths.push(match.month);
        }

        match.day = matchDate.format('YYYY-MM-DD');
        match.time = matchDate.format('HH:mm');
    });

    unique(data.daysOfCompetition);

    data.daysOfCompetition = data.daysOfCompetition.map(function (day) {
        return {
            value: day,
            nearest: day === data.nearestDayOfCompetition
        }
    });

    data.teamCountries = [];
    data.teams.forEach(function (team) {
        if (data.teamCountries.indexOf(team.country) === -1) {
            data.teamCountries.push(team.country);
        }
    });

    data.groupTeamsByCountry = false; ///(data.teamCountries.length > 1);
    return data;
};