var $ = require('jquery');
var page = require('page');

module.exports = function listenToUserEvents(appCtx) {

    var $page = $('#page');
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

};


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
