var fs = require('fs');
var path = require('path');

var queue = [];
var isWriting = false;

function processQueue() {
    if (queue.length > 0 && !isWriting) {
        var file = queue.shift();
        isWriting = true;
        fs.writeFile(file.filename, file.data, function (err) {
            if(err){
                console.error (err);
            }
            isWriting = false;
            processQueue();
        });
    } else {
        isWriting = false;
    }
}

module.exports = function write(filename, data) {
    queue.push({
        filename: path.join(__dirname, '../dist/data/' + filename + '.json'),
        data: JSON.stringify(data)
    });
    processQueue();
};

