var path = require('path');
var fs = require('fs');
var glob = require('glob');
var pattern = path.join(__dirname, 'dist', 'data', 'teams', '*_1.json');
var async = require('async');
var map = {};

glob(pattern, {}, function (err, files) {
    async.eachLimit(files, 10, function (file, fileCb) {
        fs.readFile(file, 'utf8', function (err, content) {
            if (err) {
                console.error('unable to read', file);
                return fileCb();
            }
            var json;
            try {
                json = JSON.parse(content);
            } catch (e){
                console.error('unable to parse', file);
                return fileCb();
            }

            if(json.type !== 'CENAT'){
                return fileCb();
            }

            map[json.id] = json.country;
            fileCb();
        });
    }, function () {
        async.eachOf(map, function( country,teamId, teamCb){
            var flag = path.join(__dirname, 'dist/data/flags/flags_un/48', country + '.png');
            var logo = path.join(__dirname, 'dist/data/teams/logos', teamId + '.png');
            copyFile(flag, logo, function(err){
                if (err){
                    console.error('ERR', country, teamId);
                } else {
                    console.info('OK', country, teamId);
                }

                teamCb();
            });
        }, function(){
            console.info('done');
        })
    });

});

function copyFile(source, target, cb) {
    var cbCalled = false;

    var rd = fs.createReadStream(source);
    rd.on("error", function(err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function(err) {
        done(err);
    });
    wr.on("close", function(ex) {
        done();
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}
