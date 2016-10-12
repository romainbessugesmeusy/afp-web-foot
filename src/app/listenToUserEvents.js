var $ = require('jquery');
var page = require('page');

module.exports = function listenToUserEvents(appCtx) {

    var $page = $('#page');

    //jquery mobile
    //$page.on('swipeleft', '.daysWrapper', function(){
    //    console.info('days swipe');
    //});

    $page.on('click', '.sectionNavbar button.prev', prevDateClickHandler);
    $page.on('click', '.sectionNavbar button.next', nextDateClickHandler);
    $page.on('click', '.sectionNavbar button.prev-group', prevGroupDateClickHandler);
    $page.on('click', '.sectionNavbar button.next-group', nextGroupDateClickHandler);
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

        page('?' + $.param(params));
        return false;
    });
    $page.on('click', '#competition .sectionNavbar a', function () {
        var pathname = window.location.pathname;
        if (pathname.substr(-1) === '/') {
            pathname = pathname.substr(0, pathname.length - 1);
        }
        var data = $(this).data();
        var params = {};

        params[data.param] = data.value;

        if (appCtx.competition.month && data.param !== 'month') {
            params.month = appCtx.competition.month;
        }

        if (appCtx.competition.country && data.param !== 'country') {
            params.country = appCtx.scoreboard.country;
        }

        page(pathname + '/?' + $.param(params));
        return false;
    });

    $page.on('click', '#team .sectionNavbar a', function(){
        var pathname = window.location.pathname;
        if (pathname.substr(-1) === '/') {
            pathname = pathname.substr(0, pathname.length - 1);
        }
        var data = $(this).data();
        var params = {};
        params[data.param] = data.value;
        page(pathname + '/?' + $.param(params));
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

};


function nextDateClickHandler(event) {
    var $navbar = $(event.target).closest('.sectionNavbar');
    var linkSelector = 'a.active + a';
    $navbar.find(linkSelector).click();
}

function prevDateClickHandler(event) {
    var $navbar = $(event.target).closest('.sectionNavbar');
    var index = $navbar.find('a.active').index() - 1;
    $navbar.find('a').eq(index).click();
}

function prevGroupDateClickHandler(event){
    var $navbar = $(event.target).closest('.sectionNavbar');
    var index = $navbar.find('a.current').index() - 1;
    $navbar.find('a').eq(index).click();
}
function nextGroupDateClickHandler(event){
    var $navbar = $(event.target).closest('.sectionNavbar');
    var linkSelector = 'a.current + a.next';
    $navbar.find(linkSelector).click();
}