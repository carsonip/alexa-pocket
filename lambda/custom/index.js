'use strict';
const Alexa = require('alexa-sdk');
const APP_ID = process.env.APP_ID;  // TODO replace with your app ID (OPTIONAL).
const utils = require('./utils.js');
const pocket = require('./pocket.js').create();

const RETURN_COUNT = 5;

const states = {
    START: '_START',
    READING: '_READING',
    FINISH_READING: '_FINISH_READING',
}

const languageStrings = {
    'en': {
        'translation': {
            "LINK_ACCOUNT": "to start using this skill, please use the companion app to authenticate on Amazon",
            "NO_ACTIVE_ARTICLE": "There is no reading article",
            "ARCHIVED": "Item archived",
            
            "ARTICLE_FINISH": "That's all for this article. Would you like to archive it?",
            "ARTICLE_FINISH_REPROMPT": "Say Yes to archive, or say No to do nothing. Would you like to archive the article?",
            "ARTICLE_NEXT": "Would you like to continue?",
            "ARTICLE_NEXT_REPROMPT": "Say Yes to continue, or say No to stop. Would you like to continue?",

            "LIST_EMPTY": "Your Pocket is empty. Try saving some articles to Pocket.",
            "LIST_END": "There are no more articles in list.",
            "LIST_TAG_EMPTY": "There are no articles with tag %s.",
            "LIST_START": "Here are %s of your saved articles in Pocket:",
            "LIST_TAG_START": "Here are %s of your saved articles in Pocket with tag %s:",
            "LIST_NEXT": "Here are the next %s: ",
            "LIST_PROMPT": "Which one would you like to read? Say the number, or say, next, to read the next in list.",

            "HELP": "When you say, Alexa, ask My Pocket what articles do I have, it will read you the 5 latest articles you saved. Then you may say a number, and it will read the corresponding article to you. After finish reading the article, you may archive the article. If you want to link or re-link to your account, say, Alexa, ask My Pocket to link account. Now, you can say, Start, to begin, or you can say, Stop.",
            "HELP_REPROMPT": "Say, Start, to begin, or you can say, Stop.",
            "GOODBYE": "Goodbye",

            "POCKET_ERROR": "Error accessing Pocket",
            "NO_LIST_ERROR": "No list",
            "INVALID_NUMBER_ERROR": "Invalid number",
            "INVALID_ITEM_ERROR": "Invalid item",
        }
    },
    'de-DE': {
        'translation': {
            "LINK_ACCOUNT": "Um diesen Skill verwenden zu können, starte bitte die Alexa App und verknüpfe deinen Pocket Account",
            "NO_ACTIVE_ARTICLE": "Es gibt leider keinen Artikel",
            "ARCHIVED": "Artikel archiviert",
            
            "ARTICLE_FINISH": "Das ist alles zu diesem Artikel. Möchtest du ihn archivieren?",
            "ARTICLE_FINISH_REPROMPT": "Sage ja zum Archivieren, oder sage nein um abzubrechen. Möchtest du den Artikel archivieren?",
            "ARTICLE_NEXT": "Möchtest du fortfahren?",
            "ARTICLE_NEXT_REPROMPT": "Sage ja um fortzufahren, oder sage nein um zu stoppen. Möchtest du fortfahren?",

            "LIST_EMPTY": "Deine Pocket Liste ist leer. Versuche einige Artikel in Pocket zu speichern.",
            "LIST_END": "Es gibt keine weiteren Artikel in der Liste.",
            "LIST_TAG_EMPTY": "Es gibt keine Artikel mit dem Tag %s.",
            "LIST_START": "Hier sind %s deiner gespeicherten Artikel von Pocket:",
            "LIST_TAG_START": "Hier sind %s deiner gespeicherten Artikel von Pocket mit dem Tag %s:",
            "LIST_NEXT": "Hier sind die nächsten %s: ",
            "LIST_PROMPT": "Welchen würdest du gerne hören? Sag die Nummer oder sage weiter um den nächsten in der Liste zu hören.",

            "HELP": "Wenn du sagst, Alexa, frage My Pocket welche Artikel ich habe, werde ich dir die letzten 5 gespeicherten Artikel vorlesen. Dann kannst du eine Zahl sagen und ich werde dir den entsprechenden Artikel vorlesen. Nachdem ich den Artikel vorgelesen habe kannst du ihn archivieren. Wenn du deinen Account verknüpfen willst, sage Alexa, öffne My Pocket und verknüpfe meinen Account. Jetzt sage, Start, um zu beginnen, oder sage Stop.",
            "HELP_REPROMPT": "Sage Start, um zu beginnen, oder sage Stop.",
            "GOODBYE": "Auf Wiedersehen",

            "POCKET_ERROR": "Fehler beim Zugriff auf Pocket",
            "NO_LIST_ERROR": "Keine Liste",
            "INVALID_NUMBER_ERROR": "Ungültige Nummer",
            "INVALID_ITEM_ERROR": "Ungültiger Artikel",
        }
    }
}

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers, readingHandlers, finishReadingHandlers);
    alexa.execute();
};

function linkAccount() {
    this.emit(':tellWithLinkAccountCard', this.t('LINK_ACCOUNT'));
}

function archive() {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }
    if (!this.attributes['currentArticle']) {
        this.emit(':tell', this.t('NO_ACTIVE_ARTICLE'));
        return;
    }

    let currentArticle = utils.decompress(this.attributes['currentArticle']);
    pocket.archive(this.event.session.user.accessToken, currentArticle.item_id)
        .then((response) => {
            this.emit(':tell', this.t('ARCHIVED'));
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        });
}

function prepareChunk() {
    let p = new Promise((resolve, reject) => {
        let chunkIndex = this.attributes['chunkIndex'];
        let chunks = this.attributes['chunks'];
        if (chunks && chunkIndex < chunks.length) { // The chunk is stored
            resolve('');
            return;
        }
        let currentArticle = utils.decompress(this.attributes['currentArticle']);
        let url = currentArticle.resolved_url || currentArticle.given_url;
        pocket.getArticleView(url)
            .then((data) => {
                // Make sure we don't exceed response size limits.
                let chunksLength = data.chunks.length;
                let cumulativeLength = [0]; // 1-based
                for (let i = 0; i < chunksLength; i++) {
                    cumulativeLength.push(data.chunks[i].length + cumulativeLength[i]);
                }

                // Let's say we store 16K characters
                const MAX_CHUNKS_CONTENT_LENGTH = 16 * 1024;
                let storeChunks = [];
                for (let i = 0; i < chunksLength; i++) {
                    if (i < chunkIndex) {
                        storeChunks.push('');
                    } else {
                        if (cumulativeLength[i + 1] - cumulativeLength[chunkIndex] < MAX_CHUNKS_CONTENT_LENGTH) {
                            storeChunks.push(data.chunks[i]);
                        } else {
                            break;
                        }
                    }
                }
                this.attributes['chunks'] = storeChunks;
                this.attributes['chunksLength'] = chunksLength;

                this.handler.state = states.READING;
                resolve(data.info);
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

    prepareChunk.call(this).then((info) => {
        if (this.attributes['chunkIndex'] == 0) {
            before += info || '';
        }
        let chunks = this.attributes['chunks'];
        let speechOutput = before + chunks[this.attributes['chunkIndex']];
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
    
        this.emit(':ask', speechOutput, reprompt);
    })
}

function readList(count, offset, tag) {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }

    let next = offset > 0;

    pocket.getList(this.event.session.user.accessToken, count, offset, tag)
        .then((list) => {
            this.attributes['retrieveOffset'] = offset + list.length
            this.attributes['list'] = utils.compress(list);
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
            this.emit(':ask', speechOutput, reprompt);
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        })
}

function readRandomArticle() {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }
    pocket.getList(this.event.session.user.accessToken, 10)
        .then((list) => {
            this.attributes['list'] = utils.compress(list);

            if (list.length === 0) {
                this.emit(':tell', this.t('LIST_EMPTY'));
                return;
            }

            let randomIndex = Math.floor(Math.random() * list.length);
            readArticleFromIndex.call(this, randomIndex);
        })
        .catch((error) => {
            this.emit(':tell', this.t('POCKET_ERROR'));
            console.log(error);
        })
}

function readArticleFromIndex(index) {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }

    let list = utils.decompress(this.attributes['list']);
    this.attributes['list'] = null;
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

    this.attributes['currentArticle'] = utils.compress(list[index]);

    this.attributes['chunks'] = null;
    this.attributes['chunkIndex'] = 0;
    this.attributes['chunksLength'] = 0;
    readChunk.call(this);
}

var handlers = {
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
        readList.call(this, RETURN_COUNT, 0, this.event.request.intent.slots.Tag.value);
    },
    'RetrieveNext': function () {
        readList.call(this, RETURN_COUNT, this.attributes['retrieveOffset'], this.attributes['tag']);
    },
    'ReadArticleFromIndex': function () {
        readArticleFromIndex.call(this, this.event.request.intent.slots.Number.value - 1);
    },
    'ReadRandomArticle': function () {
        readRandomArticle.call(this)
    },
    'Archive': function () {
        archive.call(this);
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = this.t('HELP');
        var reprompt = this.t('HELP_REPROMPT');
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    }
};

var readingHandlers = Alexa.CreateStateHandler(states.READING, Object.assign({
    'AMAZON.YesIntent': function () {
        readChunk.call(this);
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
}, handlers));

var finishReadingHandlers = Alexa.CreateStateHandler(states.FINISH_READING, Object.assign({
    'AMAZON.YesIntent': function () {
        this.emit('Archive');
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', this.t('GOODBYE'));
    },
}, handlers));
