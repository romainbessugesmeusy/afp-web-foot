var glob = require('glob');
var fs = require('fs');
var async = require('fs');
module.exports = function globDelete(pattern) {
    return function (done) {
        glob(pattern, function (er, files) {
            async.each(files, function (file, cb) {
                fs.unlink(file, cb);
            }, done);
        });
    }
};
