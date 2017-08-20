'use strict';
var Alexa = require('alexa-sdk');
var APP_ID = 'amzn1.ask.skill.1065618f-b70b-4308-9029-593c1445e950';  // TODO replace with your app ID (OPTIONAL).
const utils = require('./utils.js');
const pocket = require('./pocket.js').create();

const RETURN_COUNT = 5;

const states = {
    START: '_START',
    READING: '_READING',
    FINISH_READING: '_FINISH_READING',
}

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // TODO: i18n
    // To enable string internationalization (i18n) features, set a resources object.
    // alexa.resources = languageStrings;
    alexa.registerHandlers(handlers, readingHandlers, finishReadingHandlers);
    alexa.execute();
};

function linkAccount() {
    this.emit(':tellWithLinkAccountCard',
        'to start using this skill, please use the companion app to authenticate on Amazon');
}

function archive() {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }
    if (!this.attributes['currentArticle']) {
        this.emit(':tell', 'There is no reading article');
        return;
    }
    pocket.archive(this.event.session.user.accessToken, this.attributes['currentArticle'].item_id)
        .then((response) => {
            this.emit(':tell', 'Item archived');
        })
        .catch((error) => {
            this.emit(':tell', 'Error accessing Pocket');
            console.log(error);
        });
}

function readChunk(before) {
    before = before || '';

    let chunks = this.attributes['chunks'];
    let speechOutput = before + chunks[this.attributes['chunkIndex']];
    this.attributes['chunkIndex']++;

    let reprompt;

    if (this.attributes['chunkIndex'] == chunks.length) {
        this.handler.state = states.FINISH_READING;
        speechOutput += '<break time="1s"/>That\'s all for this article. Would you like to archive it?';
        reprompt = 'Say Yes to archive, or say No to do nothing. Would you like to archive the article?';
    } else {
        speechOutput += '<break time="1s"/>Would you like to continue?';
        reprompt = 'Say Yes to continue, or say No to stop. Would you like to continue?';
    }

    this.emit(':ask', speechOutput, reprompt);
}

function readList(count, offset) {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }
    pocket.getList(this.event.session.user.accessToken, count, offset)
        .then((list) => {
            this.attributes['retrieveOffset'] = (this.attributes['retrieveOffset'] || 0) + count
            this.attributes['list'] = list;

            if (list.length === 0) {
                this.emit(':tell', 'Your Pocket is empty. Try saving some articles to Pocket.');
                return;
            }

            let titles = list.map((item) => item.resolved_title).map(utils.ssmlEscape);

            let titlesJoined = titles.reduce((prev, item, i) => prev + '<break time="1s"/>' + (i + 1) + ": " + item, `Here are ${list.length} of your saved articles in Pocket:`);

            let speechOutput = '';
            speechOutput += titlesJoined + '<break time="1s"/> Which one would you like to read? Say the number, or say, next, to read the next in list.';

            let reprompt = 'Which one would you like to read? Say the number, or say, next, to read the next in list.';
            this.emit(':ask', speechOutput, reprompt);
        })
        .catch((error) => {
            this.emit(':tell', 'Error accessing Pocket');
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
            this.attributes['list'] = list;

            if (list.length === 0) {
                this.emit(':tell', 'Your Pocket is empty. Try saving some articles to Pocket.');
                return;
            }

            let randomIndex = Math.floor(Math.random() * list.length);
            readArticleFromIndex.call(this, randomIndex);
        })
        .catch((error) => {
            this.emit(':tell', 'Error accessing Pocket');
            console.log(error);
        })
}

function readArticleFromIndex(index) {
    if (this.event.session.user.accessToken == undefined) {
        linkAccount.call(this);
        return;
    }

    let list = this.attributes['list'];
    this.attributes['list'] = null;
    if (!list) {
        this.emit(':tell', 'No List');
        return;
    }

    if (list.length === 0) {
        this.emit(':tell', 'Your Pocket is empty. Try saving some articles to Pocket.');
        return;
    }

    if (index < 0 || index >= list.length) {
        this.emit(':tell', 'Wrong number');
        return;
    }
    if (!list[index]) {
        this.emit(':tell', 'Invalid item');
        return;
    }

    this.attributes['currentArticle'] = list[index];

    let url = list[index].resolved_url || list[index].given_url;
    pocket.getArticleView(url)
        .then((data) => {
            this.attributes['chunks'] = data.chunks;
            this.attributes['chunkIndex'] = 0;

            this.handler.state = states.READING;
            readChunk.call(this, data.info);
        })
        .catch((error) => {
            this.emit(':tell', 'Error accessing Pocket');
            console.log(error);
        });
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
    'RetrieveNext': function () {
        readList.call(this, RETURN_COUNT, this.attributes['retrieveOffset']);
    },
    'ReadArticleFromIndex': function () {
        readArticleFromIndex.call(this, this.event.request.intent.slots.Number.value - 1);
    },
    'ReadRandomArticle': function() {
        readRandomArticle.call(this)
    },
    'Archive': function () {
        archive.call(this);
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = 'When you say, Alexa, ask My Pocket what articles do I have, it will read you the 5 latest articles you saved. Then you may say a number, and it will read the corresponding article to you. After finish reading the article, you may archive the article. If you want to link or re-link to your account, say, Alexa, ask My Pocket to link account. Now, you can say, Start, to begin, or you can say, Stop.';
        var reprompt = 'Say, Start, to begin, or you can say, Stop.';
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', 'Goodbye');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'Goodbye');
    }
};

var readingHandlers = Alexa.CreateStateHandler(states.READING, Object.assign({
    'AMAZON.YesIntent': function () {
        readChunk.call(this);
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', 'Goodbye');
    },
}, handlers));

var finishReadingHandlers = Alexa.CreateStateHandler(states.FINISH_READING, Object.assign({
    'AMAZON.YesIntent': function () {
        this.emit('Archive');
    },
    'AMAZON.NoIntent': function () {
        this.emit(':tell', 'Goodbye');
    },
}, handlers));