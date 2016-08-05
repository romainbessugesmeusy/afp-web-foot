var $ = require('jquery');
module.exports = {

    bind: function () {
        var html = $('html');
        var body = $('body');
        $(window).on('scroll', function () {
            body.toggleClass('scroll', document.getElementById('page').getBoundingClientRect().top < -337)
        });
    },

    unbind: function () {
        $('body').removeClass('scroll');
        $(window).off('scroll');
    }
};