var unique = require('array-unique');
var async = require('async');
var writer = require('../writer');
var options = require('./options');
var getEvent = require('../lib/getEvent');
var exec = require('../lib/exec');

async.forEach(options.combinations, function (combination, eachCombination) {
    exec.event({event: combination.id, lang: combination.lang}, eachCombination);
});
module.exports = run;