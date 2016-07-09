var request = require('request');
var fs = require('fs');
var path = require('path');
var async = require('async');
var extend = require('extend');

var listeEvenementFoot = [
    {"Id": 5101, "Label": "Coupe du monde 2018 : Qualifications Zone Asie"},
    {"Id": 5039, "Label": "Coupe du monde 2018 : Qualifications CONCACAF"},
    {"Id": 5187, "Label": "CAN 2017 : Qualifications"},
    {"Id": 5405, "Label": "Coupe du monde 2018 : Qualifications Zone OFC"},
    {"Id": 5399, "Label": "Tunisie : Ligue 1 (2015/2016)"},
    {"Id": 5389, "Label": "Coupe du monde 2018 : Qualifications Zone Afrique"},
    {"Id": 5390, "Label": "Coupe du monde 2018 : Qualifications Zone Amérique du sud"},
    {"Id": 5821, "Label": "Matches amicaux de football 2016"},
    {"Id": 4571, "Label": "Euro 2016"},
    {"Id": 5507, "Label": "Norvège : Tippeligaen (2016)"},
    {"Id": 5506, "Label": "Suède : Allsvenskan (2016)"},
    {"Id": 6074, "Label": "Euro 2016 (IP)"},
    {"Id": 6092, "Label": "Copa America 2016 (IP)"},
    {"Id": 5822, "Label": "Copa America 2016"},
    {"Id": 6097, "Label": "Etats-Unis : MLS (2016)"},
    {"Id": 6100, "Label": "Ligue des Champions (2016/2017)"},
    {"Id": 6101, "Label": "Ligue Europa (2016/2017)"},
    {"Id": 6091, "Label": "France : Ligue 1 (2016/2017)"},
    {"Id": 6098, "Label": "Angleterre : Premiership (2016/2017)"},
    {"Id": 6096, "Label": "Danemark : ALKA Superliga (2016/2017)"},
    {"Id": 6099, "Label": "Autriche : Bundesliga (2016/2017)"},
    {"Id": 6103, "Label": "Suisse : Super League (2016/2017)"},
    {"Id": 6108, "Label": "Allemagne : Bundesliga (2016/2017)"},
    {"Id": 6094, "Label": "France : Ligue 2 (2016/2017)"},
    {"Id": 6095, "Label": "Belgique : Jupiler League (2016/2017)"},
    {"Id": 5853, "Label": "Football dames"},
    {"Id": 5852, "Label": "Football messieurs"},
    {"Id": 6105, "Label": "Angleterre : Championship (2016/2017)"},
    {"Id": 6102, "Label": "Pays-Bas : Eredivisie (2016/2017)"},
    {"Id": 6104, "Label": "Ecosse : Premier League (2016/2017)"},
    {"Id": 6106, "Label": "Coupe de la Ligue anglaise (2016/2017)"},
    {"Id": 5392, "Label": "Coupe du monde 2018 : Qualifications Zone Europe"},
    {"Id": 6024, "Label": "Coupe des confédérations 2017"}];

var options = {
    root: 'http://bdsports.afp.com:80/bdsapi/api/',
    lang: 1,
    evts: [/*6100,6101,4571, */5365]
};

var extract = require('./extract')(options);
var transform = require('./transform')(options);
var load = require('./load')(options);

extract(transform(load));