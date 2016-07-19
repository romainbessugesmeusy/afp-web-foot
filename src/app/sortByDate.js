module.exports = function sortByDate(asc) {
    return function (a, b) {
        var arrayValuesToInt = function (part) {
            return parseInt(part)
        };
        var pa = a.split('-').map(arrayValuesToInt);
        var pb = b.split('-').map(arrayValuesToInt);
        var up = (asc) ? pa : pb;
        var low = (asc) ? pb : pa;

        if (up[0] !== low[0]) {
            return up[0] - low[0]
        }

        if (up[1] !== low[1]) {
            return up[1] - low[1];
        }

        if (up[2] !== low[2]) {
            return up[2] - low[2];
        }

        return 0;
    }
};