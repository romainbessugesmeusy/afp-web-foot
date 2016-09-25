module.exports = function extractScoreboardTeamInfo(team) {
    var obj = {
        id: team.TeamId,
        name: (team.TeamName === '?') ? null : team.TeamName,
        goals: (team.TeamScore === -1) ? null : team.TeamScore,
        penaltyShootoutGoals: team.TeamTabScore,
        qualified: team.TeamStatusCode === 'PAWIN',
        cards: {
            yellow: team.TeamNbYellowCards,
            red: team.TeamNbRedCards
        }
    };

    if (obj.qualified === false) {
        delete obj.qualified;
    }

    if (obj.penaltyShootoutGoals === null || obj.penaltyShootoutGoals === -1) {
        delete obj.penaltyShootoutGoals;
    }

    if (obj.goals === null) {
        delete obj.goals;
    }

    if (obj.cards.yellow === 0) {
        delete obj.cards.yellow;
    }

    if (obj.cards.red === 0) {
        delete obj.cards.red;
    }

    if (typeof obj.cards.red === 'undefined' && typeof obj.cards.yellow === 'undefined') {
        delete obj.cards;
    }

    return obj;
}
