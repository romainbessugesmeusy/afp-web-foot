module.exports = function processTeamData(data) {

    for(var eventId in data.competitions){
        if(!data.competitions.hasOwnProperty(eventId)){
            continue;
        }

        var competition = data.competitions[eventId];
        competition.staff = competition.staff.map(function(playerId){
            return data.staffMap[playerId];
        });

        var now = new Date();
        competition.isCurrent = new Date(competition.startDate) < now && new Date(competition.endDate) > now;
    }

    return data;
};