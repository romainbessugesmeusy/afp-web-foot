var fileExists = require('./fileExists');
var request = require('request');
var fs = require('fs');

var isDownloading = {};

var release = function (uri, err, arg) {

    if (typeof isDownloading[uri] === 'undefined') {
        console.error('undefined URI', uri);
        return;
    }

    isDownloading[uri].forEach(function (cb) {
        cb(err, arg);
    });

    delete isDownloading[uri];
};

module.exports = function downloadFile(uri, filename, callback) {

    if (typeof isDownloading[uri] !== 'undefined') {
        isDownloading[uri].push(callback);
        return;
    } else {
        isDownloading[uri] = []
    }

    isDownloading[uri].push(callback);

    fileExists(filename, function () {
        release(uri, null, true);
    }, function () {
        console.info('downloading', uri);
        var req = request({uri: uri, timeout: 1000});
        //var req = request({uri: uri, timeout: 1000});
        req.pause();
        req.on('error', function (err) {
            console.error('Error downloading ', uri);
            console.error(err);
            release(uri, err);
        });
        req.on('response', function (res) {
            if (res.statusCode === 200) {
                req.pipe(fs.createWriteStream(filename));
                req.resume();
            } else {
                release(uri, {statusCode: res.statusCode})
            }
        }).on('close', function () {
            release(uri, null, true);
        });
    })
};
