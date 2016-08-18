var watch = require('node-watch');
var fs = require('fs');
var async = require('async');
var glob = require('glob');
var debounce = require('debounce');
var path = require('path');

var options = require('./options');
var extract = require('./extract')(options);
var transform = require('./transform')(options);
var write = require('./writer');

var notificationsPath = path.join(__dirname, '/../dist/data/notifications');
var cachePath = path.join(__dirname, '/../dist/data/cache');

var busy = false;
var startOver = false;
var deleting = false;

var watcherOptions = {
    followSymLinks: true,
    recursive: false,
    filter: function (filename) {
        return filename.indexOf('.DS_Store') === -1;
    }
};

var debouncedParse = debounce(parseNotifications, 300);


function parseFileTimestamp(ts) {
    return new Date(
        ts.substr(0, 4) + '-'
        + ts.substr(4, 2) + '-'
        + ts.substr(6, 2) + 'T'
        + ts.substr(9, 2) + ':'
        + ts.substr(11, 2) + ':'
        + ts.substr(13, 2)
    )
}

function uniqueProp(arr, prop) {
    var values = [];
    arr.forEach(function (item) {
        if (item[prop] && values.indexOf(item[prop]) === -1) {
            values.push(item[prop]);
        }
    });
    return values;
}

function globDelete(pattern) {
    return function (done) {
        glob(pattern, function (er, files) {
            async.forEach(files, function (file, cb) {
                //console.info('delete', file);
                fs.unlink(file, cb);
            }, done);
        });
    }
}

function startOverIfNeeded(){
    if (startOver) {
        startOver = false;
        parseNotifications();
    }
}

function parseNotifications() {
    //console.info('parsingNotifications call');
    if (busy) {
        //console.info('parser is busy, it should start over');
        startOver = true;
        return;
    }

    //console.info('parser is NOW busy');
    busy = true;
    var invalidate = [];
    //var now = new Date();
    fs.readdir(notificationsPath, function (err, files) {

        if(files.length === 0 || (files.length === 1 && files[0] === '.DS_Store')){
            busy = false;
            //console.info('no more files to treat');
            startOverIfNeeded();
            return;
        }

        //console.info('read all files in notifications dir', files.length);

        async.forEach(files, function (filename, cb) {
            var find = filename.match(/([0-9]{8}T[0-9]{6})-([0-9]+)-([A-Z]+)\.json/);
            // file does not match notification pattern
            if (find === null) {
                return cb();
            }

            var date = parseFileTimestamp(find[1]);
            if (find[3] === 'MATCH') {
                fs.readFile(notificationsPath + '/' + filename, 'utf-8', function (err, content) {
                    var json;
                    try {
                        json = JSON.parse(content);
                    } catch (err) {
                        //console.error('json parse error', filename);
                        return cb();
                    }
                    invalidate.push({
                        filename: notificationsPath + '/' + filename,
                        type: find[3],
                        date: date,
                        match: parseInt(find[2]),
                        event: json.Citius.EvenementId,
                        group: json.Citius.GroupId
                    });
                    return cb();
                });
            } else {
                invalidate.push(invalidate.push({
                    filename: notificationsPath + '/' + filename,
                    type: find[3],
                    date: date,
                    event: parseInt(find[2])
                }));
                return cb();
            }
        }, function () {
            //console.info('all files read');
            //console.info('notification count', invalidate.length);
            if (invalidate.length === 0) {
                busy = false;
                startOverIfNeeded();
                return;
            }
            var groups = uniqueProp(invalidate, 'group');
            var events = uniqueProp(invalidate, 'event');
            var matches = uniqueProp(invalidate, 'match');

            deleting = true;
            async.parallel([
                globDelete(cachePath + '/xcclassementgroupe_*_*_+(' + groups.join('|') + ').json'),
                globDelete(cachePath + '/xcmatchdetail_*_+(' + matches.join('|') + ').json'),
                globDelete(cachePath + '/xc+(statistiques|phases)_*_+(' + events.join('|') + ').json'),
                globDelete(cachePath + '/xcequipes_*_+(' + events.join('|') + ')_*.json')
            ], function () {
                deleting = false;
                //console.info('all cache files deleted');
                extract(transform(write, function () {
                    var notificationsToRemove = uniqueProp(invalidate, 'filename');
                    async.forEach(notificationsToRemove, function (notificationFile, cb) {
                        //console.info('unlink', notificationFile);
                        fs.unlink(notificationFile, cb);
                    }, function () {
                        //console.info('parser is no more busy');
                        //console.info('should start over ?', startOver);
                        busy = false;
                        startOverIfNeeded();
                    });
                }));
            });

        });
    });
}


console.info('start watching', notificationsPath);

watch(notificationsPath, watcherOptions, function(){
    if(deleting === false){
        debouncedParse();
    }
});


extract(transform(write));