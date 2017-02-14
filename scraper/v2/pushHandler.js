var Route = require('route-parser');
var exec = require('../lib/exec');

var pushRouteSpecs = {
    'aaevenementinfo/:lang/:event': ['event'],
    'xcclassementbuteurs/:lang/:event': ['event'],
    'xcclassementbuteurs/:lang/:event/:phase': ['event'],
    'xcclassementgroupe/:lang/:event/:group': ['event'],
    'xcequipes/:lang/:event/:phase': ['event'],
    'xcequipestaff/:lang/:event/:team': ['event'],
    'xclivematch/:lang/:match/:event': ['match'],
    'xcmatchdetail/:lang/:match/:event': ['match'],
    'xcmatchesphase/:lang/:phase': [], // waiting for :event from AFP
    'xcphases/:lang/:event': ['event'],
    'xcstatistiques/:lang/:event': ['event']
};

var pushRoutes = [];

for (var spec in pushRouteSpecs) {
    pushRoutes.push({
        route: new Route(spec),
        gen: pushRouteSpecs[spec]
    });
}


module.exports = function pushHandler(filename) {

    filename = filename.replace('.json', '');
    filename = filename.substr(filename.lastIndexOf('/') + 1);
    filename = filename.replace(/_/g, '/');

    pushRoutes.forEach(function (pushRoute) {
        var match = pushRoute.route.match(filename);
        if (match === false)
            return;

        pushRoute.gen.forEach(function (gen) {
            exec[gen](match);
        });
    });
};
