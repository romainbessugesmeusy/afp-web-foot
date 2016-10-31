var options = require('../options.json');
var request = require('request');
var mkdirp = require('mkdirp');
var async = require('async');
var path = require('path');
var fs = require('fs');
var stylus = require('stylus');

function ClientStylesheet(client, cb) {

    var self = this;
    self.clientDirectory = path.join(__dirname, '../../dist/data/clients/', client.id);
    self.client = client;
    self.done = cb;
    mkdirp(self.clientDirectory, function () {
        switch (client.custom_styling) {
            case 'NO':
                return cb();
            case 'STYLUS':
                return self.stylus();
            case 'CSS':
                return self.css();
            case 'VARS':
                return self.vars();
        }
        cb();
    });
}

ClientStylesheet.prototype.stylus = function () {
    var self = this;

    stylus.render(this.client.stylus, function (err, css) {
        self.write(css);
    });
};
ClientStylesheet.prototype.css = function () {
    this.write(this.client.css);
};
ClientStylesheet.prototype.vars = function () {
    var self = this;

    function imgSrc(src) {
        return '"' + src + '?w=1000&q=80"';
    }

    fs.readFile(path.join(__dirname, '../../src/stylus/custom.styl'), 'utf8', function (err, content) {
        var clientVars = self.client.style_vars || {};
        var stylusVars = {};

        if (clientVars.fontFamily) {
            stylusVars.font = '"' + clientVars.fontFamily + '"' + ', Helvetica, sans-serif';
        }

        if (clientVars.textColor) {
            stylusVars.textColor = clientVars.textColor;
        }

        if (clientVars.backgroundColor) {
            stylusVars.bgColor = clientVars.backgroundColor;
        }

        if (clientVars.imageBackground) {
            // todo download image ?
            stylusVars.imageBackground = '$bgColor url(' + clientVars.imageBackground.src + ')';
        }

        if (clientVars.scoreboardImage) {
            stylusVars.scoreboardLiveBackground = imgSrc(clientVars.scoreboardImage.src);
        }

        if (clientVars.teamImage) {
            stylusVars.teamBackground = imgSrc(clientVars.teamImage.src);
        }

        if (clientVars.matchImage) {
            stylusVars.matchHeaderBackground = imgSrc(clientVars.matchImage.src);
        }

        if (clientVars.lightBackgroundColor) {
            stylusVars.lightBgColor = clientVars.lightBackgroundColor;
        }

        var stylusStr = '';
        for (var varname in stylusVars) {
            if (stylusVars.hasOwnProperty(varname)) {
                stylusStr += '\n$' + varname + ' = ' + stylusVars[varname];
            }
        }

        self.client.stylus = content.replace('/* VARS */', stylusStr);
        self.stylus();
    });
};
ClientStylesheet.prototype.getFilename = function () {
    return path.join(this.clientDirectory, 'client.css');
};
ClientStylesheet.prototype.write = function (content) {
    fs.writeFile(this.getFilename(), content, this.done);
};


module.exports = function createOptions(cb) {
    request('https://www.campsi.io/api/v1/projects/afp/collections/clients/entries', function (err, res) {
        var json = JSON.parse(res.body);
        async.forEach(json.entries, function (entry, entryCb) {
            options.clients[entry.data.id] = {
                sport: entry.data.sport,
                lang: entry.data.lang,
                locale: entry.data.locale,
                evts: String(entry.data.events).replace(/[\s\n]/g, '').split(',')
            };

            new ClientStylesheet(entry.data, entryCb);
        });
        cb(options);
    });
};