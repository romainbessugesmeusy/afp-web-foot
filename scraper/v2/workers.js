require('workerpool').worker({
    match: require('./match'),
    event: require('./event')
});