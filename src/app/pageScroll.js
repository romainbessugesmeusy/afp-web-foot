var $ = require('jquery');
module.exports = {

    bind: function (ctx, next) {
        var html = $('html');
        var body = $('body');
        $(window).on('scroll', function () {
            body.toggleClass('scroll', document.getElementById('page').getBoundingClientRect().top < -337)
        });
        next();
    },

    unbind: function (ctx, next) {
        $('body').removeClass('scroll');
        $(window).off('scroll');
        next();
    }
};