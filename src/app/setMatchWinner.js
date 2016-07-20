module.exports = function setMatchWinner(match) {
    var winner;

    if (typeof match.home.penaltyShootoutScore !== 'undefined') {
        winner = (match.home.penaltyShootoutScore > match.away.penaltyShootoutScore) ? 'home' : 'away';
    } else if (typeof match.home.goals !== 'undefined') {
        winner = (match.home.goals > match.away.goals) ? 'home' : 'away';
    }

    if (winner) {
        match[winner].winner = true;
    }
    return match;
};