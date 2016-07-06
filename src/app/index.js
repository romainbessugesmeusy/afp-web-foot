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

page('/', function () {
    $page.empty().append(views.scoreboard());
});

page('/matches/:matchId', function () {
    $page.empty().append(views.match({}));
});

$page.on('click', '.sectionNavbar a', function () {
    $(this).closest('nav').find('a').removeClass('active');
    $(this).addClass('active');
    return false;
});

page();