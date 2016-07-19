var $ = require('jquery');

module.exports = function paginateNavbar($navbar) {

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
