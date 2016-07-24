module.exports = function (data) {
    var now = new Date();
    data.forEach(function(competition){
        if(new Date(competition.endDate) < now){
            competition.status = 'finished';
        } else if(new Date(competition.startDate) > now){
            competition.status = 'upcoming';
        } else {
            competition.status = 'current';
        }
    });
    console.info('processedCompetitionsData', data);
    return data;
};