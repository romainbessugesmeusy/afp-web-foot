var Handlebars = require('handlebars');
var moment = require('moment');
require('moment/locale/fr');

moment.locale('fr');
console.info(moment.locale())

Handlebars.registerHelper('each_competition', function (dateObject, date, options) {
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

Handlebars.registerHelper('relativeDate', function (date, options) {
    var diff = moment(new Date()).diff(moment(date, 'YYYY-MM-DD'), 'days');
    if (Math.abs(diff) > 2){
        return moment(date, 'YYYY-MM-DD').format('dddd D MMMM');
    }

    return moment(date, 'YYYY-MM-DD').fromNow();
});

module.exports = Handlebars;