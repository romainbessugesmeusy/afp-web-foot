var fs = require('fs');

module.exports = function (filename, existCb, notExistCb) {
    fs.stat(filename, function (err) {
        if (err != null && err.code === 'ENOENT') {
            return notExistCb();
        }
        existCb();
    });
};