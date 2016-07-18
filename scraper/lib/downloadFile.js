var fileExists = require('./fileExists');
var request = require('request');
var fs = require('fs');

module.exports = function downloadFile(uri, filename, callback) {
    fileExists(filename, function () {
        callback(null, true)
    }, function () {
        var req = request(uri);
        req.pause();
        req.on('error', function (err) {
            console.error('Error downloading ', uri);
            console.error(err);
            callback(err);
        });
        req.on('response', function (res) {
            if (res.statusCode === 200) {
                req.pipe(fs.createWriteStream(filename));
                req.resume();
            } else {
                callback({statusCode: res.statusCode})
            }
        }).on('close', function () {
            callback(null, true);
        });
    })
};
