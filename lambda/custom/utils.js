const cheerio = require('cheerio');
const zlib = require('zlib');
// Using size instead of character count to avoid underestimation due to UTF-8 character byte size
// e.g. Chinese characters. Although Alexa cannot read Chinese, don't let it crash.
const MAX_PARAGRAPH_SIZE = 3500; // bytes

function ssmlEscape(str) {
    str = str.replace(/&/g, ' and ');
    str = str.replace(/"/g, '');
    str = str.replace(/</g, '');
    str = str.replace(/>/g, '');
    str = str.replace(/\u00A0/g, ' ');
    return str;
}

function xmlEscape(str) {
    // https://developer.amazon.com/docs/custom-skills/display-interface-reference.html#xml-special-characters
    str = str.replace(/&/g, '&amp;');
    str = str.replace(/"/g, '&quot;');
    str = str.replace(/'/g, '&apos;');
    str = str.replace(/</g, '&lt;');
    str = str.replace(/>/g, '&gt;');
    str = str.replace(/\\/g, `\\`);
    str = str.replace(/\u00A0/g, '&#160;');
    return str;
}

function objToArr(obj) {
    return Object.keys(obj).map((k) => obj[k]);
}

function getArticleMetadata(data) {
    return {
        title: data.title,
        authors: objToArr(data.authors).map((author) => author.name),
        // Workaround for invalid time input
        // "datePublished": "0000-00-00 00:00:00", "timePublished": -62169962400,
        time: data.datePublished === '0000-00-00 00:00:00' ? null : data.timePublished
    }
}

function getArticleMetadataSsml(metadata) {
    let info = '';

    // title
    info += ssmlEscape(metadata.title) + '<break strength="x-strong"/>';

    // author
    let authors = metadata.authors.map(ssmlEscape);
    if (authors.length > 0) info += this.t('BY') + ' ' + authors.join(',') + '<break strength="x-strong"/>';

    // date
    // metadata.time is UNIX timestamp
    if (metadata.time !== null) {
        let date = new Date(metadata.time * 1000);
        let dateStr = `${date.getFullYear()}${('0' + (date.getMonth()+1)).slice(-2)}${('0' + date.getDate()).slice(-2)}`;
        info += `<say-as interpret-as="date" format="ymd">${dateStr}</say-as><break strength="x-strong"/>`;
    }

    info += '<break time="1s"/>';

    return info;
}

function getParagraphs(article) {
    const $ = cheerio.load(article);
    let text = getText($, $.root())
    let paragraphs = text.split('\n');
    // Remove empty elements
    return paragraphs.filter(x => x);
}

const BLOCK_ELEMENTS = new Set(['address', 'article', 'aside', 'blockquote', 'canvas', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'figcaption', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'noscript', 'ol', 'output', 'p', 'pre', 'section', 'table', 'tfoot', 'ul', 'video'])

function getText($, el) {
    // Recursively get text of element el
    // Block elements are wrapped with linebreaks

    let text = '';
    if (el[0].type === 'text') {
        text += $(el).text()
        return text;
    }

    // Add linebreak before and after block elements
    // As we only care about the paragraphing,
    // there is no side effect in this case.
    let isBlockElement = BLOCK_ELEMENTS.has(el[0].name);
    if (isBlockElement) {
        text += '\n';
    }

    // Special handling for list
    if (el[0].name === 'ol') {
        el.children().each(function(i, e) {
            text += `${i + 1}: ${$(e).text()}\n`;
        })
    } else if (el[0].name === 'ul') {
        el.children().each(function(i, e) {
            text += $(e).text() + '\n';
        })
    } else {
        el.contents().each(function(i, e) {
            text += getText($, $(e));
        });
    }

    if (isBlockElement) {
        text += '\n';
    }
    return text;
}

function divideContent(paragraphs) {
    // Return a nested list of paragraphs
    let chunks = [];
    let last = paragraphs.reduce((prev, para, i) => {
        if (getByteLen(prev.join('') + para) < MAX_PARAGRAPH_SIZE) {
            prev.push(para)
            return prev;
        } else {
            chunks.push(prev);
            return [para];
        }
    }, []);
    chunks.push(last);
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
exports.xmlEscape = xmlEscape;
exports.objToArr = objToArr;
exports.getParagraphs = getParagraphs;
exports.getText = getText;
exports.divideContent = divideContent;
exports.getArticleMetadata = getArticleMetadata;
exports.getArticleMetadataSsml = getArticleMetadataSsml;
exports.filterMetadata = filterMetadata;
exports.compress = compress;
exports.decompress = decompress;
exports.getByteLen = getByteLen;
