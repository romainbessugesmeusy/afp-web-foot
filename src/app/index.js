'use strict';

// deps
var $ = require('jquery');
var page = require('page');
var io = require('socket.io-client');

window.io = io;

// templates and partials
// expose the light runtime for browser
var handlebars = require('handlebars/runtime');
// require the partials to be used in the views
var partials = require('../gen/partials');
// require the views
var views = require('../gen/views');

var deparam = require('./deparam');

// DOM
var $page = $('#page');

var $pages = {
    match: $('#match'),
    scoreboard: $('#scoreboard'),
    team: $('#team'),
    teams: $('#teams'),
    competition: $('#competition'),
    competitions: $('#competitions')
};

var appCtx = {
    currentPage: '',
    scoreboard: {
        upcomingDate: null,
        pastDate: null
    },
    data: {
        scoreboard: null,
        match: {},
        team: {},
        competition: {},
        player: {}
    }
};

// Data Processors
var processScoreboardData = require('./processScoreboardData');
var processMatchData = require('./processMatchData');

var showPage = function (page, callNext) {
    return function (ctx, next) {
        if (appCtx.currentPage !== page) {
            window.requestAnimationFrame(function () {
                $page.find('.page').hide();
                page.show();
            });
            appCtx.currentPage = page;
        }
        if (callNext) {
            next();
        }
    }
};

var paginateNavbar = function ($navbar) {

    var activePage = Math.floor($navbar.find('a.active').index() / 6);
    $navbar.find('a').each(function (i, a) {
        var page = Math.floor(i / 6);
        var state;

        if (page < activePage) {
            state = 'prev';
        } else if (page > activePage) {
            state = 'next';
        } else {
            state = 'current';
        }

        $(a).removeClass('prev next current').addClass(state);
    });
};

var handleDateParams = function (ctx, next) {

    // Warning ! window.location.search isn't populated as it should
    // /?pastDate=2016-07-01&upcomingDate=2016-07-04
    var params = (ctx.querystring) ? deparam(ctx.querystring) : {};

    // take the first links to get the defaults
    params.upcomingDate = params.upcomingDate || $('a[data-param="upcomingDate"]:eq(0)').attr('data-value');
    params.pastDate = params.pastDate || $('a[data-param="pastDate"]:eq(0)').attr('data-value');


    var $upcomingMatchesTabs = $('#upcomingMatchesTabs');
    var $pastMatchesTabs = $('#pastMatchesTabs');

    // in the same rendering frame
    // we activate the tab and link for both
    window.requestAnimationFrame(function () {

        if (appCtx.scoreboard.upcomingDate !== params.upcomingDate) {
            $('a[data-param="upcomingDate"]').removeClass('active');
            $upcomingMatchesTabs.find('.tab.date').removeClass('active');
            $('a[data-param="upcomingDate"][data-value="' + params.upcomingDate + '"]').addClass('active').removeClass('prev next');
            $('#upcomingMatches-date-' + params.upcomingDate).addClass('active');
            // store in order to preserve browser repaints
            appCtx.scoreboard.upcomingDate = params.upcomingDate;
            paginateNavbar($upcomingMatchesTabs.find('.sectionNavbar'))
        }

        if (appCtx.scoreboard.pastDate !== params.pastDate) {
            $('a[data-param="pastDate"]').removeClass('active');
            $pastMatchesTabs.find('.tab.date').removeClass('active');
            $('[data-param="pastDate"][data-value="' + params.pastDate + '"]').addClass('active').removeClass('prev next');
            $('#pastMatches-date-' + params.pastDate).addClass('active');
            appCtx.scoreboard.pastDate = params.pastDate;
            paginateNavbar($pastMatchesTabs.find('.sectionNavbar'))
        }

        next();
    });

};

page('/', function (ctx, next) {

    // scoreboard data already processed, next
    // when live data will be there, we'll need to test a 'lastRefreshDate' value
    if (appCtx.data.scoreboard) {
        return next();
    }

    $.getJSON('/data/scoreboard.json', function (data) {
        console.info('scoreboardData', data);
        appCtx.data.scoreboard = processScoreboardData(data, {
            displayedDays: 6,
            pastMatchesOffset: sessionStorage.getItem('pastMatchesOffset') || 0 // this looks unnecessary now
        });
        console.info('scoreboardDataProcessed', appCtx.data.scoreboard);
        $pages.scoreboard.empty().append(views.scoreboard(appCtx.data.scoreboard));
        next();
    });

}, handleDateParams, unbindMatchScroll, showPage($pages.scoreboard));

page('/matches/:matchId/*', function (ctx, next) {
    if (appCtx.data.match.id === parseInt(ctx.params.matchId)) {
        return next();
    }

    $.getJSON('/data/matches/' + ctx.params.matchId + '.json', function (data) {
        var match = processMatchData(data);
        console.info('processedMatchData', match);
        appCtx.currentMatchId = ctx.params.matchId;
        $pages.match.empty().append(views.match(match));
        next()
    });
}, bindMatchScroll, showPage($pages.match, true));


function activateMatchTab(id) {
    return function () {
        window.requestAnimationFrame(function () {
            $('.sectionNavbar a').removeClass('active');
            $('.tab').removeClass('active');
            $('a[data-target="' + id + '"]').addClass('active');
            $('#' + id).addClass('active');
        })
    }
}

page('/matches/:matchId/evenements', activateMatchTab('events'));
page('/matches/:matchId/tirs-au-but', activateMatchTab('penaltyShootout'));
page('/matches/:matchId/composition', activateMatchTab('composition'));
page('/matches/:matchId/infos', activateMatchTab('infos'));

page('/competitions', function () {

}, showPage($pages.competitions));

page('/competitions/:competition', function () {

}, showPage($pages.competition));


function bindMatchScroll(ctx, next) {
    var $body = $('body');
    $body.on('scroll', function () {
        $body.toggleClass('scroll', $page[0].getBoundingClientRect().top < -337)
    });
    next();
}

function unbindMatchScroll(ctx, next) {
    $('body').off('scroll');
    next();
}

function updateScoreboardNavbars() {
    $('.sectionNavbar').each(function () {
        var $this = $(this);
        $this.find('button.prev').toggle($this.find('a.prev').length > 0);
        $this.find('button.next').toggle($this.find('a.next').length > 0);
    })
}
function nextDateClickHandler(event) {
    var $navbar = $(event.target).closest('.sectionNavbar');
    var linkSelector = 'a.current + a.next';
    $navbar.find(linkSelector).click();
}

function prevDateClickHandler(event) {
    var $navbar = $(event.target).closest('.sectionNavbar');
    var index = $navbar.find('a.current').index() - 1;
    $navbar.find('a').eq(index).click();
}

$page.on('click', '.sectionNavbar button.prev', prevDateClickHandler);
$page.on('click', '.sectionNavbar button.next', nextDateClickHandler);
$page.on('click', '#scoreboard .sectionNavbar a', function () {
    var data = $(this).data();
    var params = {};

    params[data.param] = data.value;

    if (appCtx.scoreboard.pastDate && data.param !== 'pastDate') {
        params.pastDate = appCtx.scoreboard.pastDate;
    }

    if (appCtx.scoreboard.upcomingDate && data.param !== 'upcomingDate') {
        params.upcomingDate = appCtx.scoreboard.upcomingDate;
    }

    page('/?' + $.param(params));
    return false;
});

$page.on('click', '#toggleComments', function () {
    var $btn = $(this);
    var state = $btn.attr('data-state');
    $page.find('.group').toggle(state === 'off');
    $page.find('.event.both').toggle(state === 'off');
    $page.find('.event .comment').toggle(state === 'off');
    var newState = state === 'on' ? 'off' : 'on';
    $btn.text($btn.attr('data-message-' + newState));
    $btn.attr('data-state', newState);
});
page();