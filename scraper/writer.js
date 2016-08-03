var fs = require('fs');
var path = require('path');
var fileExists = require('./lib/fileExists');
var queue = [];
var isWriting = false;

function processQueue() {

    if (queue.length > 0 && !isWriting) {
        var file = queue.shift();
        isWriting = true;

        var writeFile = function(){
            fs.writeFile(file.filename, file.data, function (err) {
                if(err){
                    console.error (err);
                }
                isWriting = false;
                processQueue();
            });
        };

        fileExists(file.filename,function(){
            fs.readFile(file.filename, 'utf-8', function(err, content){
               if(content == file.data){
                   isWriting = false;
                   processQueue();
               } else {
                   writeFile();
               }
            });
        }, writeFile);
    }
}

module.exports = function write(filename, data) {
    queue.push({
        filename: path.join(__dirname, '../dist/data/' + filename + '.json'),
        data: JSON.stringify(data)
    });
    processQueue();
};

