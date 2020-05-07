'use strict';
const Alexa = require('alexa-sdk');
const makeRichText = Alexa.utils.TextUtils.makeRichText;
const makePlainText = Alexa.utils.TextUtils.makePlainText;
const APP_ID = process.env.APP_ID;  // TODO replace with your app ID (OPTIONAL).
const utils = require('./utils.js');
const pocket = require('./pocket.js').create();

const RETURN_COUNT = 5;
// Total number of bytes to store in this batch of chunks
// This is to workaround the 24KB response size limit
const MAX_CHUNKS_CONTENT_SIZE = 16 * 1024; 

const TITLE = 'My Pocket';

const states = {
    START: '_START',
    READING: '_READING',
    FINISH_READING: '_FINISH_READING',
}

const languageStrings = require('./language-strings.json');

function accessTokenExist() {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return false;
    }
    return true;
}

function linkAccount() {
    this.emit(':tellWithLinkAccountCard', this.t('LINK_ACCOUNT'));
}

function archive() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    let currentArticle = list[this.attributes['currentIndex']];

    pocket.archive(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':ask', this.t('ARCHIVED') + this.t('ARTICLE_FINISH'), this.t('ARTICLE_FINISH_REPROMPT'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function unarchive() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    let currentArticle = list[this.attributes['currentIndex']];

    pocket.unarchive(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':ask', this.t('UNARCHIVED') + this.t('ARTICLE_FINISH'), this.t('ARTICLE_FINISH_REPROMPT'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function favorite() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    let currentArticle = list[this.attributes['currentIndex']];

    pocket.favorite(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':ask', this.t('FAVORITED') + this.t('ARTICLE_FINISH'), this.t('ARTICLE_FINISH_REPROMPT'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function unfavorite() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    let currentArticle = list[this.attributes['currentIndex']];

    pocket.unfavorite(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':ask', this.t('UNFAVORITED') + this.t('ARTICLE_FINISH'), this.t('ARTICLE_FINISH_REPROMPT'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function itemDelete() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    let currentArticle = list[this.attributes['currentIndex']];

    pocket.delete(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':ask', this.t('DELETED') + this.t('ARTICLE_FINISH'), this.t('ARTICLE_FINISH_REPROMPT'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function prepareChunk() {
    let p = new Promise((resolve, reject) => {
        let chunkIndex = this.attributes['chunkIndex'];
        let chunks = utils.decompress(this.attributes['chunks']);
        if (chunks && chunkIndex < chunks.length) { // The chunk is stored
            resolve(null);
            return;
        }
        let list = utils.decompress(this.attributes['list']);
        let currentArticle = list[this.attributes['currentIndex']];
        let url = currentArticle.resolved_url || currentArticle.given_url;
        pocket.getArticleView(url)
            .then((data) => {
                // Make sure we don't exceed response size limits.
                let chunksLength = data.chunks.length;
                let cumulativeSize = [0]; // 1-based
                for (let i = 0; i < chunksLength; i++) {
                    cumulativeSize.push(utils.getByteLen(data.chunks[i].join('')) + cumulativeSize[i]);
                }

                let storeChunks = [];
                for (let i = 0; i < chunksLength; i++) {
                    if (i < chunkIndex) {
                        storeChunks.push(null);
                    } else {
                        if (cumulativeSize[i + 1] - cumulativeSize[chunkIndex] < MAX_CHUNKS_CONTENT_SIZE) {
                            storeChunks.push(data.chunks[i]);
                        } else {
                            break;
                        }
                    }
                }
                this.attributes['chunks'] = utils.compress(storeChunks);
                this.attributes['chunksLength'] = chunksLength;

                this.handler.state = states.READING;
                resolve(data.metadata);
            })
            .catch((error) => {
                this.emit(':tell', this.t('POCKET_ERROR'));
                console.log(error);
            });
        });
    return p;
}

function readChunk(before) {
    before = before || '';

    prepareChunk.call(this).then((metadata) => {
        const isFirstChunk = this.attributes['chunkIndex'] === 0;
        if (isFirstChunk && metadata) {
            before += utils.getArticleMetadataSsml.call(this, metadata) || '';
        }
        let chunks = utils.decompress(this.attributes['chunks']);
        // Chunks are arrays of arrays
        // We get the current chunk, SSML escape all of the paragraphs in it, then merge them.
        let chunk = chunks[this.attributes['chunkIndex']];
        let speechOutput = before + chunk.map(utils.ssmlEscape).join('<break time="1s"/>');
        this.attributes['chunkIndex']++;
    
        let reprompt;
    
        if (this.attributes['chunkIndex'] == this.attributes['chunksLength']) {
            this.handler.state = states.FINISH_READING;
            speechOutput += `<break time="1s"/>${this.t('ARTICLE_FINISH')}`;
            reprompt = this.t('ARTICLE_FINISH_REPROMPT');
        } else {
            speechOutput += `<break time="1s"/>${this.t('ARTICLE_NEXT')}`;
            reprompt = this.t('ARTICLE_NEXT_REPROMPT');
        }
    
        if (this.event.context.System.device.supportedInterfaces.Display) {
            const builder = new Alexa.templateBuilders.BodyTemplate1Builder();

            let text = '';
            if (isFirstChunk && metadata) {
                text += `<b>${utils.xmlEscape(metadata.title)}</b><br/>`;
                if (metadata.authors.length > 0) {
                    text += `${utils.xmlEscape(metadata.authors.join(', '))}<br/>`;
                }
                if (metadata.time !== null) {
                    let date = new Date(metadata.time * 1000);
                    text += `${date.getFullYear()}-${('0' + (date.getMonth()+1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}<br/>`;
                }
                text += '<br/>';
            }
            text += chunk.map(utils.xmlEscape).join('<br/><br/>');

            const template = builder.setTitle(TITLE)
                .setTextContent(makeRichText(text))
                .build();
        
            this.response.speak(speechOutput)
                .listen(reprompt)
                .renderTemplate(template);
            this.emit(':responseReady');
        } else {
            this.emit(':ask', speechOutput, reprompt);
        }
    })
}

function readList(count, offset, tag) {
    if (!accessTokenExist.call(this)) return;

    let next = offset > 0;

    pocket.getList(this.event.session.user.accessToken, count, offset, tag)
        .then((list) => {
            this.attributes['retrieveOffset'] = offset + list.length
            this.attributes['list'] = utils.compress(list.map(utils.filterMetadata));
            this.attributes['tag'] = tag;

            if (list.length === 0) {
                if (next) {
                    this.emit(':tell', this.t('LIST_END'));
                } else {
                    if (tag) this.emit(':tell', this.t('LIST_TAG_EMPTY', tag));
                    else this.emit(':tell', this.t('LIST_EMPTY'));
                }
                return;
            }

            let titles = list.map((item) => item.resolved_title).map(utils.ssmlEscape);

            let opening = !next ? (!tag ? this.t('LIST_START', list.length) : this.t('LIST_TAG_START', list.length, tag)) : this.t('LIST_NEXT', list.length);

            let titlesJoined = titles.reduce((prev, item, i) =>
                prev + '<break time="1s"/>' + (i + 1) + ": " + item, opening
            );

            let speechOutput = '';
            speechOutput += titlesJoined + `<break time="1s"/>${this.t('LIST_PROMPT')}`;

            let reprompt = this.t('LIST_PROMPT');
            if (this.event.context.System.device.supportedInterfaces.Display) {

                let titlesDisplay = titles.reduce((prev, item, i) =>
                    prev + (i + 1) + ": " + item + '<br/><br/>',
                    ''
                );

                const builder = new Alexa.templateBuilders.BodyTemplate1Builder();

                const template = builder.setTitle(TITLE)
                    .setTextContent(makeRichText(titlesDisplay))
                    .build();
            
                this.response.speak(speechOutput)
                    .listen(reprompt)
                    .renderTemplate(template);
                this.emit(':responseReady');
            } else {
                this.emit(':ask', speechOutput, reprompt);
            }
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        })
}

function readRandomArticle(tag) {
    if (!accessTokenExist.call(this)) return;

    pocket.getList(this.event.session.user.accessToken, 10, 0, tag)
        .then((list) => {
            this.attributes['list'] = utils.compress(list.map(utils.filterMetadata));
            this.attributes['tag'] = tag;

            let randomIndex = Math.floor(Math.random() * list.length);
            readArticleFromIndex.call(this, randomIndex);
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        })
}

function readArticleFromIndex(index) {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    
    if (!list) {
        this.emit(':tell', this.t('NO_LIST_ERROR'));
        return;
    }

    if (list.length === 0) {
        this.emit(':tell', this.t('LIST_EMPTY'));
        return;
    }

    if (index < 0 || index >= list.length) {
        this.emit(':tell', this.t('INVALID_NUMBER_ERROR'));
        return;
    }
    if (!list[index]) {
        this.emit(':tell', this.t('INVALID_ITEM_ERROR'));
        return;
    }

    // index of article in list
    this.attributes['currentIndex'] = index;

    this.attributes['chunks'] = null;
    this.attributes['chunkIndex'] = 0;
    this.attributes['chunksLength'] = 0;
    readChunk.call(this);
}

function readNextArticle() {
    if (!accessTokenExist.call(this)) return;

    let list = utils.decompress(this.attributes['list']);
    
    if (!list) {
        this.emit(':tell', this.t('NO_LIST_ERROR'));
        return;
    }

    if (list.length === 0) {
        this.emit(':tell', this.t('LIST_EMPTY'));
        return;
    }

    let nextIndex = this.attributes['currentIndex'] + 1 || 0;
    if (nextIndex >= list.length) {
        pocket.getList(this.event.session.user.accessToken, RETURN_COUNT, this.attributes['retrieveOffset'], this.attributes['tag'])
        .then((list) => {
            this.attributes['retrieveOffset'] += list.length
            this.attributes['list'] = utils.compress(list.map(utils.filterMetadata));
            readArticleFromIndex.call(this, 0);
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        })
    } else {
        readArticleFromIndex.call(this, nextIndex);
    }

}

let handlers = {
    'LaunchRequest': function () {
        this.emit('Retrieve');
    },
    'LinkAccount': function () {
        linkAccount.call(this);
    },
    'Retrieve': function () {
        readList.call(this, RETURN_COUNT, 0);
    },
    'RetrieveWithTag': function () {
        let tag = this.event.request.intent.slots.Tag;
        if (tag && tag.value) {
            tag = tag.value.toLowerCase();
        }
        readList.call(this, RETURN_COUNT, 0, tag);
    },
    'Next': function () {
        readList.call(this, RETURN_COUNT, this.attributes['retrieveOffset'], this.attributes['tag']);
    },
    'AMAZON.NextIntent': function () {
        readList.call(this, RETURN_COUNT, this.attributes['retrieveOffset'], this.attributes['tag']);
    },
    'ReadArticleFromIndex': function () {
        readArticleFromIndex.call(this, this.event.request.intent.slots.Number.value - 1);
    },
    'ReadRandomArticle': function () {
        let tag = this.event.request.intent.slots.Tag;
        if (tag && tag.value) {
            tag = tag.value.toLowerCase();
        }
        readRandomArticle.call(this, tag)
    },
    'Archive': function () {
        archive.call(this);
    },
    'Unarchive': function () {
        unarchive.call(this);
    },
    'Favorite': function () {
        favorite.call(this);
    },
    'Unfavorite': function () {
        unfavorite.call(this);
    },
    'Delete': function () {
        itemDelete.call(this);
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', this.t('HELP'), this.t('HELP_REPROMPT'));
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
    'AMAZON.PreviousIntent': function () {
        this.emit(':tell', this.t('NOT_SUPPORTED'));
    },
    'SessionEndedRequest': function () {},
};

let readingHandlers = Alexa.CreateStateHandler(states.READING, Object.assign({}, handlers, {
    'AMAZON.YesIntent': function () {
        readChunk.call(this);
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
    'Next': function () {
        readChunk.call(this);
    },
    'AMAZON.NextIntent': function () {
        readChunk.call(this);
    },
}));

let finishReadingHandlers = Alexa.CreateStateHandler(states.FINISH_READING, Object.assign({}, handlers, {
    'Next': function () {
        readNextArticle.call(this);
    },
    'AMAZON.NextIntent': function () {
        readNextArticle.call(this);
    },
}));

exports.handler = function (event, context, callback) {
    let alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers, readingHandlers, finishReadingHandlers);
    alexa.execute();
};
