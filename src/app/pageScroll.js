var $ = require('jquery');
module.exports = {

    bind: function (ctx, next) {
        var $body = $('body');
        $body.on('scroll', function () {
            $body.toggleClass('scroll', document.getElementById('page').getBoundingClientRect().top < -337)
        });
        next();
    },

    unbind: function (ctx, next) {
        $('body').off('scroll');
        next();
    }
};