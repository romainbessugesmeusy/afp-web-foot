var fs = require('fs');
var XmlStream = require('xml-stream');

module.exports = function parseCommentFile(filename, cb) {
    var comments = [];
    var stream = fs.createReadStream(filename);
    var cbCalled = false;

    var end = function (err) {
        if (err && err.code !== 'ENOENT') {
            console.warn(err.message);
        }
        if (!cbCalled) {
            cb(comments);
            cbCalled = true;
        }
    };

    stream.on('error', end);
    stream.on('readable', function () {
        try {
            var xml = new XmlStream(stream, 'utf8');
            xml.preserve('comments', false);
            xml.collect('comment');
            xml.on('error', end);
            xml.on('end', end);
            xml.on('endElement: comments', function (item) {
                comments = item.$children.map(function (comment) {
                    return {
                        props: comment.$,
                        text: comment.$text
                    }
                });
                end();
            });
        } catch (err) {
            end(err);
        }
    });
}

