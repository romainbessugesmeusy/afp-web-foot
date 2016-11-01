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
        console.info(uri, 'DOWNLOAD');
        var req = request(uri);
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
                console.error('Error downloading', uri, res.statusCode);
                release(uri, {statusCode: res.statusCode})
            }
        }).on('close', function () {
            console.info('Finished downloading', uri);
            release(uri, null, true);
        });
        req.resume();
    })
};
