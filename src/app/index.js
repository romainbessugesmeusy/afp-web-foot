'use strict';

// deps
var $ = require('jquery');
var page = require('page');
var io = require('socket.io-client');
// templates and partials
// expose the light runtime for browser
var handlebars = require('handlebars/runtime');
// require the partials to be used in the views & the views
var partials = require('../gen/partials');
var views = require('../gen/views');
// DOM
var $page = $('#page'); // useless ?
var $pages = {
    match: $('#match'),
    scoreboard: $('#scoreboard'),
    team: $('#team'),
    teams: $('#teams'),
    competition: $('#competition'),
    competitions: $('#competitions')
};

var appCtx = window.appCtx = {
    currentPage: '',
    scoreboard: {
        upcomingDate: null,
        pastDate: null
    },
    competition: {
        month: null,
        country: null
    },
    data: {
        scoreboard: null,
        match: {},
        team: {},
        competition: {},
        player: {}
    }
};

// functions
var processScoreboardData = require('./processScoreboardData');
var processMatchData = require('./processMatchData');
var processCompetitionData = require('./processCompetitionData');
var processTeamData = require('./processTeamData');
var activateMatchTab = require('./activateMatchTab');
var pageScroll = require('./pageScroll');

var handleDateParams = require('./handleDateParams')(appCtx);
var listenToUserEvents = require('./listenToUserEvents')(appCtx);
var showPage = require('./showPage')(appCtx);


//
// SCOREBOARD
//
page('/', function (ctx, next) {
    // scoreboard data already processed, next
    // when live data will be there, we'll need to test a 'lastRefreshDate' value
    if (appCtx.data.scoreboard) {
        return next();
    }

    $.getJSON('/data/scoreboard.json', function (data) {
        appCtx.data.scoreboard = processScoreboardData(data);
        console.info('scoreboardDataProcessed', appCtx.data.scoreboard);
        $pages.scoreboard.empty().append(views.scoreboard(appCtx.data.scoreboard));
        next();
    });

}, handleDateParams, pageScroll.unbind, showPage($pages.scoreboard));
//
// SCOREBOARD EXIT (reset date params in context)
page.exit('/', function (ctx, next) {
    delete appCtx.scoreboard.upcomingDate;
    delete appCtx.scoreboard.pastDate;
    next();
});

//
// INDIVIDUAL MATCH
//
page('/matches/:matchId/*', function (ctx, next) {
    if (appCtx.currentMatchId === parseInt(ctx.params.matchId)) {
        return next();
    }

    $.getJSON('/data/matches/' + ctx.params.matchId + '.json', function (data) {
        var match = processMatchData(data);
        console.info('processedMatchData', match);
        appCtx.currentMatchId = parseInt(ctx.params.matchId);
        $pages.match.empty().append(views.match(match));
        next()
    });
}, pageScroll.bind, showPage($pages.match, true));

//
// MATCH TABS (called after the individual match route)
//
page('/matches/:matchId/evenements', activateMatchTab('events'));
page('/matches/:matchId/tirs-au-but', activateMatchTab('penaltyShootouts'));
page('/matches/:matchId/composition', activateMatchTab('composition'));
page('/matches/:matchId/infos', activateMatchTab('infos'));

//
// COMPETITIONS DASHBOARD
//
page('/competitions', function (ctx, next) {
    $.getJSON('/data/competitions.json', function (data) {
        console.info('competitionsData', data);
        $pages.competitions.empty().append(views.competitions(data));
        next();
    });

}, showPage($pages.competitions));

//
// INDIVIDUAL COMPETITION
//
page('/competitions/:competitionId', function (ctx, next) {

    if (appCtx.currentCompetitionId === parseInt(ctx.params.competitionId)) {
        return next();
    }

    $.getJSON('/data/competitions/' + ctx.params.competitionId + '.json', function (data) {
        var competition = processCompetitionData(data);
        console.info('processedCompetitionData', competition);
        $pages.competition.empty().append(views.competition(competition));
        appCtx.currentCompetitionId = competition.id;
        next();
    });
}, handleCompetitionParams, showPage($pages.competition));

var deparam = require('./deparam');
var moment = require('moment');

function handleCompetitionParams(ctx, next) {
    var params = (ctx.querystring) ? deparam(ctx.querystring) : {};
    var $aDayOfCompetition = $('a[data-param="dayOfCompetition"].nearest');

    // take the first links to get the defaults
    params.dayOfCompetition = params.dayOfCompetition || $aDayOfCompetition.attr('data-value');
    params.country = params.country || $('a[data-param="country"]:eq(0)').attr('data-value');

    // in the same rendering frame
    // we activate the tab and link for both
    window.requestAnimationFrame(function () {
        if (appCtx.competition.dayOfCompetition !== params.dayOfCompetition) {
            $('a[data-param="dayOfCompetition"]').removeClass('active');
            $('.calendarWrapper').find('.daysWrapper').removeClass('active');

            $('a[data-param="dayOfCompetition"][data-value="' + params.dayOfCompetition + '"]')
                .addClass('active')
                .removeClass('prev next');

            $('.daysWrapper[data-day="' + params.dayOfCompetition + '"]').addClass('active');
            // store in order to preserve browser repaints
            appCtx.competition.dayOfCompetition = params.dayOfCompetition;
        }
        next();
    });
}
//
// INDIVIDUAL TEAM
//
page('/teams/:teamId', function (ctx, next) {
    $.getJSON('/data/teams/' + ctx.params.teamId + '.json', function (data) {
        var team = processTeamData(data);
        console.info('processedTeamData', team);
        $pages.team.empty().append(views.team(team));
        next();
    });
}, showPage($pages.team));

page();