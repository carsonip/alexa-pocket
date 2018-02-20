const cheerio = require('cheerio');
const zlib = require('zlib');
const MAX_PARAGRAPH_LEN = 3500; // characters

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
        if (prev.length + para.length + divider.length < MAX_PARAGRAPH_LEN) {
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

function compress(obj) {
    return zlib.deflateSync(JSON.stringify(obj)).toString('base64');
}

function decompress(compressed) {
    return JSON.parse(zlib.inflateSync(new Buffer(compressed, 'base64')).toString());
}

exports.ssmlEscape = ssmlEscape;
exports.objToArr = objToArr;
exports.getParagraphs = getParagraphs;
exports.divideContent = divideContent;
exports.getArticleInfo = getArticleInfo;
exports.compress = compress;
exports.decompress = decompress;
