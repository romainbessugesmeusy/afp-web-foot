var handlebars = require('handlebars');

handlebars.registerHelper('each_competition', function (dateObject, date, options) {
    if (typeof dateObject === 'undefined') {
        console.error('dateObject is undefined');
        return '';
    }

    var ret = '';
    var competitionId;
    for (competitionId in dateObject[date]) {
        if (dateObject[date].hasOwnProperty(competitionId)) {
            ret += options.fn({
                matches: dateObject[date][competitionId],
                competition: options.data.root.competitions[competitionId]
            });
        }
    }

    return ret;
});

handlebars.registerHelper('testHelper', function (a, b, options) {
    return 'a:' + a + ', b:' + b;
});
module.exports = handlebars;