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

var updateActiveTabs = function () {
    $('.tabs').each(function () {
        var $tabs = $(this);
        var activeTab = sessionStorage.getItem('activeTab_' + $tabs.attr('id'));
        if (activeTab) {
            $tabs.find('a').removeClass('active').filter('a[href="' + activeTab + '"]').addClass('active');
            $tabs.find('.tab').removeClass('active').filter(activeTab).addClass('active');
        }
    });
};

page('/', function () {
    unbindMatchScroll();
    $.getJSON('/data/scoreboard.json', function (data) {
        console.info('scoreboardData', data);
        var scoreboard = processScoreboardData(data, {
            displayedDays: 6,
            pastMatchesOffset: sessionStorage.getItem('pastMatchesOffset') || 0
        });
        console.info('scoreboardDataProcessed', scoreboard);
        $page.empty().append(views.scoreboard(scoreboard));
        $page.find('.sectionNavbar .current:eq(0)').click();
        updateActiveTabs();
        updateScoreboardNavbars();
    });
});

page('/matches/:matchId', function (ctx) {
    unbindMatchScroll();
    $.getJSON('/data/matches/' + ctx.params.matchId + '.json', function (data) {
        console.info('matchData', data);
        var match = processMatchData(data);
        console.info('matchDataProcessed', match);
        $page.empty().append(views.match(match));
        bindMatchScroll();
        updateActiveTabs();
    });
});

page('/competitions', function () {
    $page.empty().append(views.competitions({}));
});

page('/competitions/:competition', function () {
    $page.empty().append(views.competition({}));
});

page('/equipes', function () {
    $page.empty().append(views.equipes({}));
});

page('/equipes/:equipe', function () {
    $page.empty().append(views.equipe({}));
});

page('/joueurs', function () {
    $page.empty().append(views.joueurs({}));
});

page('/joueurs/:joueur', function () {
    $page.empty().append(views.joueur({}));
});


$page.on('click', '.tabs .sectionNavbar a', function () {
    var $a = $(this);
    var $tabs = $a.closest('.tabs');

    $a.closest('nav').find('a').removeClass('active');
    $a.addClass('active');
    $tabs.find('.tab').removeClass('active');
    $tabs.find($a.attr('href')).addClass('active');
    sessionStorage.setItem('activeTab_' + $tabs.attr('id'), $a.attr('href'));
    return false;
});

function bindMatchScroll() {
    $('body').on('scroll', function () {
        $page.toggleClass('scroll', $page[0].getBoundingClientRect().top < -337)
    });
}

function unbindMatchScroll() {
    $('body').off('scroll');
}

function updateScoreboardNavbars(){
    $('.sectionNavbar').each(function(){
        var $this = $(this);
        $this.find('button.prev').toggle($this.find('a.prev').length > 0);
        $this.find('button.next').toggle($this.find('a.next').length > 0);
    })
}
function paginateDatesHandler(state) {
    var inverse = 'next';
    if (state === 'next') {
        inverse = 'prev';
    }

    return function (event) {
        var $navbar = $(event.target).closest('.sectionNavbar');
        $navbar.find('.current').removeClass('current').addClass(inverse);
        var links = $navbar.find('a.' + state);
        var i = 0;
        var k;
        for (; i < links.length; i++) {
            if (i < 5) {
                k = (state === 'prev') ? links.length - i - 1 : i;
                $(links[k]).removeClass(state).addClass('current');
            }
        }
        $navbar.find('.current:eq(0)').click();

        var prevDateCount = $navbar.find('a.prev').length;

        $navbar.find('button.prev').toggle(prevDateCount > 0);
        $navbar.find('button.next').toggle($navbar.find('a.next').length > 0);
    }
}

$page.on('click', '.sectionNavbar button.prev', paginateDatesHandler('prev'));
$page.on('click', '.sectionNavbar button.next', paginateDatesHandler('next'));
page();