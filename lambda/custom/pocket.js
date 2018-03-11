const axios = require('axios');
const utils = require('./utils.js');
var pocketPrivate;
try {
    pocketPrivate = require('./pocket-private.js');
} catch (e) {
    pocketPrivate = {};
}
const CONSUMER_KEY = process.env.consumer_key;

const BASE_URL = 'https://getpocket.com/';

let instance = axios.create({
    baseURL: BASE_URL,
    timeout: 2000,
    headers: { 'X-Accept': 'application/json' }
});


function Pocket() {
    this.archive = function (accessToken, itemId) {
        let p = instance.post('v3/send', {
            consumer_key: CONSUMER_KEY,
            access_token: accessToken,
            actions: [
                {
                    action: 'archive',
                    item_id: itemId,
                }
            ]
        });
        return p;
    };

    this.getList = function (accessToken, count, offset, tag) {

        offset = offset || 0;

        let p = new Promise((resolve, reject) => {
            let data = {
                consumer_key: CONSUMER_KEY,
                access_token: accessToken,
                count: count,
                offset: offset,
                contentType: 'article',
                sort: 'newest',
                detailType: 'simple'
            };
            if (tag) data.tag = tag;
            instance.post('v3/get', data)
                .then((response) => {
                    let list = utils.objToArr(response.data.list);

                    // sort by sort_id
                    list.sort((a, b) => a.sort_id - b.sort_id);

                    resolve(list);
                })
                .catch((error) => {
                    reject(error);
                });
        });
        return p;
    };

    this.getArticleView = pocketPrivate.getArticleView;
}

exports.create = function () {
    return new Pocket();
}