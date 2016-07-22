var moment = require('moment');

module.exports = function processCompetitionData(data) {
    data.matchesMonths = [];

    var uniqueMonths = [];

    data.matches.forEach(function (match) {
        var date = moment(match.date);
        match.month = date.format('YYYY-MM');

        if (uniqueMonths.indexOf(match.month) === -1) {
            data.matchesMonths.push({value: match.month, label: date.format('MMMM')});
            uniqueMonths.push(match.month);
        }

        match.day = date.format('YYYY-MM-DD');
        match.time = date.format('HH:mm');
    });

    data.matchesMonths.reverse();

    data.teamCountries = [];
    data.teams.forEach(function(team){
        if(data.teamCountries.indexOf(team.country) === -1){
            data.teamCountries.push(team.country);
        }
    });

    data.groupTeamsByCountry = false; ///(data.teamCountries.length > 1);
    return data;
};