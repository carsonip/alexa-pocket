const cheerio = require('cheerio');
const zlib = require('zlib');
// Using size instead of character count to avoid underestimation due to UTF-8 character byte size
// e.g. Chinese characters. Although Alexa cannot read Chinese, don't let it crash.
const MAX_PARAGRAPH_SIZE = 3500; // bytes

function ssmlEscape(speech) {
    speech = speech.replace(/&/g, ' and ');
    speech = speech.replace(/</g, '');
    speech = speech.replace(/"/g, '');
    return speech;
}

function objToArr(obj) {
    return Object.keys(obj).map((k) => obj[k]);
}

function getArticleInfo(data) {
    let info = '';

    // title
    info += ssmlEscape(data.title) + '<break strength="x-strong"/>';

    // author
    let authors = objToArr(data.authors).map((author) => author.name).map(ssmlEscape);
    if (authors.length > 0) info += 'by ' + authors.join(',') + '<break strength="x-strong"/>';

    // date
    // "datePublished": "2012-03-05 00:00:00"
    info += `<say-as interpret-as="date" format="ymd">${data.datePublished.substr(0, 10).replace(/-/g, '')}</say-as><break time="1s"/>`;

    return info;
}

function getParagraphs(article) {
    const $ = cheerio.load(article);

    let paragraphs = $('p').map(function () {
        return $(this).text();
    }).get();

    return paragraphs;
}

function divideContent(paragraphs) {
    const divider = '<break strength="x-strong"/>';
    let chunks = [];
    // every chunk ends with divider
    paragraphs.reduce((prev, para, i) => {
        if (getByteLen(prev + para + divider) < MAX_PARAGRAPH_SIZE) {
            if (i == paragraphs.length - 1) {
                chunks.push(prev + para + divider);
                return '';
            }
            return prev + para + divider;
        } else {
            chunks.push(prev);
            if (i == paragraphs.length - 1) {
                chunks.push(para + divider);
                return '';
            }
            return para;
        }
    }, '');
    return chunks;
}

function filterMetadata(item) {
    const ALLOWED = ['item_id', 'given_url', 'resolved_url'];
    const newItem = Object.keys(item)
        .filter(key => ALLOWED.includes(key))
        .reduce((obj, key) => {
            obj[key] = item[key];
            return obj;
        }, {});
    return newItem;
}

function compress(obj) {
    if (!obj) return;
    return zlib.deflateSync(JSON.stringify(obj)).toString('base64');
}

function decompress(compressed) {
    if (!compressed) return;
    return JSON.parse(zlib.inflateSync(new Buffer(compressed, 'base64')).toString());
}

function getByteLen(val) {
    // Force string type
    val = String(val);

    var byteLen = 0;
    for (var i = 0; i < val.length; i++) {
        var c = val.charCodeAt(i);
        byteLen += c < (1 <<  7) ? 1 :
                   c < (1 << 11) ? 2 :
                   c < (1 << 16) ? 3 :
                   c < (1 << 21) ? 4 :
                   c < (1 << 26) ? 5 :
                   c < (1 << 31) ? 6 : Number.NaN;
    }
    return byteLen;
}

exports.ssmlEscape = ssmlEscape;
exports.objToArr = objToArr;
exports.getParagraphs = getParagraphs;
exports.divideContent = divideContent;
exports.getArticleInfo = getArticleInfo;
exports.filterMetadata = filterMetadata;
exports.compress = compress;
exports.decompress = decompress;
exports.getByteLen = getByteLen;
