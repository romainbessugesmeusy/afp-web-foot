var fs = require('fs');
var path = require('path');
var request = require('request');
var fileExists = require('../lib/fileExists');

var fetch = function (resource, params, callback, compareFn) {
    if (typeof this.options === 'undefined') {
        this.options = {
            root: 'http://bdsports.afp.com/bdsapi/api/',
            lang: '1'
        };
    }

    var self = this;

    var uriParams = function (resource, params) {
        return resource.replace(/:\w+/g, function (param) {
            return params[param.substring(1)] || self.options[param.substring(1)];
        });
    };

    var apiUri = function (resource) {
        return self.options.root + resource;
    };

    var unlinkAndFetchRemote = function (filename, resource, params, callback, invalidateFn) {
        //console.info('invalidating:', filename);
        fs.unlink(filename, function () {
            fetch(resource, params, callback, invalidateFn);
        });
    };

    var uri = uriParams(resource, params);
    var cacheFilename = path.join(__dirname, '../../dist/data/cache/' + uri.replace(/\//g, '_') + '.json');
    var json;

    function invalidate() {
        unlinkAndFetchRemote(cacheFilename, resource, params, callback, compareFn);
    }

    fileExists(cacheFilename, function () {
        fs.readFile(cacheFilename, 'utf8', function (readFileError, data) {
            if (readFileError) {
                return invalidate();
            }

            try {
                json = JSON.parse(data);
            } catch (jsonParseError) {
                console.info(data);
                return invalidate();
            }
            //var json = require(cacheFilename);
            if (compareFn === true) {
                return invalidate();
            }

            if (typeof compareFn === 'function' && compareFn(json) === true) {
                return invalidate();
            }

            return callback(null, json);
        });
    }, function () {
        request({
            url: apiUri(uri),
            timeout: 2500,
            agentOptions: {
                maxSockets: 30,
                keepAlive: false
            }
        }, function (error, response, body) {
            var now = new Date();
            if (error) {
                console.error(now.toJSON() + ' ; ' + apiUri(uri) + ' ; ' + error.message);
                return callback();
            }

            if (parseInt(response.statusCode) !== 200) {
                console.error(now.toJSON() + ' ; ' + apiUri(uri) + ' ; ' + response.statusCode + ' ; ' + body);
                return callback();
            }

            try {
                json = JSON.parse(body);
            } catch (err) {
                console.error('error parsing ' + uri);
                console.error(response.statusCode);
                console.error(body);
                return callback(err);
            }

            fs.writeFile(cacheFilename, body, function (err) {
                if (err) {
                    console.error('error writing ' + uri);
                    return callback(err, json);
                }
                json.__new = true;
                callback(null, json);
            });
        });
    });
};

module.exports = fetch;

module.exports.INVALIDATE = true;
module.exports.CACHE = false;