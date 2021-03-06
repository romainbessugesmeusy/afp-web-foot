var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var fileExists = require('./lib/fileExists');
var queue = [];
var isWriting = false;
var noop = function () {

};

function processQueue() {

    if (queue.length > 0 && !isWriting) {
        var file = queue.shift();
        var contents = JSON.stringify(file.data);
        isWriting = true;

        file.callback = file.callback || noop;
        var writeFile = function () {
            mkdirp(path.dirname(file.filename), function (mkdirErr) {
                if (mkdirErr) {
                    console.error(mkdirErr);
                }
                fs.writeFile(file.filename, contents, function (err) {
                    if (err) {
                        console.error(err);
                    }
                    file.callback();
                    isWriting = false;
                    file = null;
                    contents = null;
                    processQueue();
                });

            });
        };

        //fileExists(file.filename, function () {
        //    return writeFile();
        //    fs.readFile(file.filename, 'utf-8', function (err, content) {
        //        if (content == contents) {
        //             todo https://www.npmjs.com/package/crc
                    //file.callback();
                    //isWriting = false;
                    //file = null;
                    //contents = null;
                    //processQueue();
                //} else {
                //    writeFile();
                //}
            //});
        //}, writeFile);
        writeFile();
    }
}

module.exports = function write(filename, data, cb) {
    queue.push({
        filename: path.join(__dirname, '../dist/data/' + filename + '.json'),
        data: data,
        callback: cb
    });
    processQueue();
};

