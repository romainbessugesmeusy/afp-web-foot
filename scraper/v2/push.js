require('../../socket/server');

var path = require('path');
var watch = require('node-watch');
var exec = require('../lib/exec');
var clear = require('clear');

var p = function (dir) {
    return path.join(__dirname, '/../../dist/data/', dir);
};

watch(p('notifications'), {followSymLinks: true, recursive: false}, require('./notificationHandler'));
watch(p('comments'), {followSymLinks: true, recursive: true}, require('./commentHandler'));
watch(p('cache'), {followSymLinks: true, recursive: false}, require('./pushHandler'));