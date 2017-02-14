require('workerpool').worker({
    match: require('./match'),
    event: require('./event'),
    xscoreboard: require('./scoreboard'),
    //all: require('./all'),
    // players: require('./players')
});