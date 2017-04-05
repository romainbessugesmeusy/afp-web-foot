require('../../socket/server');

var path = require('path');
var watch = require('../lib/redis-file-watch');
var exec = require('../lib/exec');
var clear = require('clear');
var options = require('./options');

watch('notifications', require('./notificationHandler'));
watch('comments', require('./commentHandler'));
watch('cache', require('./pushHandler'));

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