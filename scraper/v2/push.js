require('../../socket/server');

var path = require('path');
var watch = require('node-watch');
var exec = require('../lib/exec');
var clear = require('clear');
var options = require('./options');

var p = function (dir) {
    return path.join(__dirname, '/../../dist/data/', dir);
};

watch(p('notifications'), {followSymLinks: true, recursive: false}, require('./notificationHandler'));
watch(p('comments'), {followSymLinks: true, recursive: true}, require('./commentHandler'));
watch(p('cache'), {followSymLinks: true, recursive: false}, require('./pushHandler'));

function tock() {
    exec.events({combinations: options.combinations}, function () {
        console.info('events done');
    });


    exec.scoreboards({clients: Object.keys(options.clients)}, function () {
        console.info('scoreboards done');
        tick();
    });
}

function tick() {
    setTimeout(tock, 1000 * 60);
}

tock();