var dump = require('./dump');

module.exports = function getEvenementMetadata(evenement, dataCode) {
    var value = '';
    if(!evenement.ExtData){
        console.error('ExtData is undefined', evenement, dataCode);
        return '';
    }
    evenement.ExtData.forEach(function (extData) {
        if (extData.ExtDataCode === dataCode) {
            value = extData.ValTxt;
        }
    });
    return value;
};