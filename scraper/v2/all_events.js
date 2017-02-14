var async = require('async');
var options = require('./options');
var exec = require('../lib/exec');

async.forEach(options.combinations, function (combination, eachCombination) {
    exec.event({event: combination.id, lang: combination.lang}, eachCombination);
});