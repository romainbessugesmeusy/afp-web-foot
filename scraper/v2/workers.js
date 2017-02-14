require('workerpool').worker({
    match: require('./match'),
    event: require('./event'),
    scoreboard: require('./scoreboard')
    //all: require('./all'),
    // players: require('./players')
});