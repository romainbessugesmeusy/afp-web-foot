var setMatchWinner = require('../../src/app/setMatchWinner');
var extractScoreboardTeamInfo = require('./extractScoreboardTeamInfo');

module.exports = function createLightMatch(event, phaseCode, match) {
    var m = {
        id: match.Id,
        date: match.Date,
        time: match.Minute,
        competition: event.id,
        competitionName: event.label,
        phase: phaseCode,
        group: match.GroupId,
        status: match.StatusCode,
        dayOfCompetition: match.Journee,
        home: extractScoreboardTeamInfo(match.Home),
        away: extractScoreboardTeamInfo(match.Away)
    };

    setMatchWinner(m);
    return m;
};