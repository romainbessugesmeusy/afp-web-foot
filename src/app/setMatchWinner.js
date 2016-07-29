module.exports = function setMatchWinner(match) {

    if (typeof match.home.winner !== 'undefined') {
        return match;
    }

    function compareScore(prop) {
        if (match.home[prop] > match.away[prop]) {
            match.home.winner = true;
        } else if (match.home[prop] < match.away[prop]) {
            match.away.winner = true;
        }
    }

    compareScore('goals');
    compareScore('penaltyShootoutGoals');
    return match;
};