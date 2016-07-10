'use strict';

// deps
var $ = require('jquery');
var page = require('page');

// templates and partials
// expose the light runtime for browser
var handlebars = require('handlebars/runtime');
// require the partials to be used in the views
var partials = require('../gen/partials');
// require the views
var views = require('../gen/views');

// DOM
var $page = $('#page');

// Data Processors
var processScoreboardData = require('./processScoreboardData');
var processMatchData = require('./processMatchData');

var updateActiveTabs = function(){
    $('.tabs').each(function(){
        var $tabs = $(this);
        var activeTab = sessionStorage.getItem('activeTab_' + $tabs.attr('id'));
        if(activeTab){
            $tabs.find('a').removeClass('active').filter('a[href="' + activeTab + '"]').addClass('active');
            $tabs.find('.tab').removeClass('active').filter(activeTab).addClass('active');
        }
    });
};

page('/', function () {
    $.getJSON('/data/scoreboard.json', function (data) {
        var scoreboard = processScoreboardData(data);
        $page.empty().append(views.scoreboard(scoreboard));
        updateActiveTabs();
    });
});

page('/matches/:matchId', function (ctx) {
    $.getJSON('/data/matches/' + ctx.params.matchId + '.json', function (data) {
        console.info('matchData', data);
        $page.empty().append(views.match(processMatchData(data)));
        updateActiveTabs();
    });
});

page('/competitions', function () {
    $page.empty().append(views.competitions({}));
});

page('/competitions/:competition', function () {
    $page.empty().append(views.competition({}));
});

$page.on('click', '.tabs .sectionNavbar a', function () {
    var $a = $(this);
    var $tabs = $a.closest('.tabs');

    $a.closest('nav').find('a').removeClass('active');
    $a.addClass('active');
    $tabs.find('.tab').removeClass('active');
    $tabs.find($a.attr('href')).addClass('active');
    sessionStorage.setItem('activeTab_' + $tabs.attr('id'),$a.attr('href'));
    return false;
});

page();