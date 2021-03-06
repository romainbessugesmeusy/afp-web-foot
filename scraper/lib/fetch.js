var fs = require('fs');
var path = require('path');
var request = require('request');
var fileExists = require('./fileExists');


module.exports = function (options) {

    var uriParams = function (resource, params) {
        return resource.replace(/:\w+/g, function (param) {
            return params[param.substring(1)] || options[param.substring(1)];
        });
    };

    var apiUri = function (resource) {
        return options.root + resource;
    };

    var unlinkAndFetchRemote = function (filename, resource, params, callback, invalidateFn) {
        //console.info('invalidating:', filename);
        fs.unlink(filename, function () {
            fetch(resource, params, callback, invalidateFn);
        });
    };

    var fetch = function (resource, params, callback, compareFn) {
        var uri = uriParams(resource, params);
        var cacheFilename = path.join(__dirname, '../../dist/data/cache/' + uri.replace(/\//g, '_') + '.json');
        var json;

        function invalidate() {
            unlinkAndFetchRemote(cacheFilename, resource, params, callback, compareFn);
        }

        fileExists(cacheFilename, function () {
            fs.readFile(cacheFilename, 'utf8', function (readFileError, data) {
                if (readFileError) {
                    console.error(readFileError);
                    return invalidate();
                }

                try {
                    json = JSON.parse(data);
                } catch (jsonParseError) {
                    console.error(jsonParseError);
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
            console.info('downloading:', uri);
            request({
                url : apiUri(uri),
                timeout: 1000,
                agentOptions: {
                    maxSockets: 100,
                    keepAlive: true
                }
            }, function (error, response, body) {
                if (error) {
                    console.error(error);
                    return callback(error);
                }
                try {
                    json = JSON.parse(body);
                } catch (err) {
                    console.error(err.message);
                    console.info(apiUri(uri), body);
                    console.dir(response);
                    return callback(err);
                }

                //console.info('finished donwloading:', uri);

                fs.writeFile(cacheFilename, body, function (err) {
                    //console.info('file written to disk:', cacheFilename);
                    if (err) {
                        return callback(err, json);
                    }
                    json.__new = true;
                    callback(null, json);
                });
            });
        });
    };

    return fetch;
};