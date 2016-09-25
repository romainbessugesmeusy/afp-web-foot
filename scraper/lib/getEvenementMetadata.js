var dump = require('./dump');

module.exports = function getEvenementMetadata(evenement, dataCode) {
    var value = '';
    evenement.ExtData.forEach(function (extData) {
        if (extData.ExtDataCode === dataCode) {
            value = extData.ValTxt;
        }
    });
    return value;
};