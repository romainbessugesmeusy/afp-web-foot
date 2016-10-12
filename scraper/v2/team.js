var team = JSON.parse(process.argv[2]);
var lang = process.argv[3] || '1';

var dump = require('../lib/dump');

var async = require('async');
var util = require('util');
var extend = require('extend');
var path = require('path');

var fetch = require('./fetch');
var writer = require('../writer');

function run(){
    //fetch()
}

run();