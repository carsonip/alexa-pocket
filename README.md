# My Pocket: Unofficial Pocket Alexa Skill

[![Build Status](https://travis-ci.org/carsonip/alexa-pocket.svg?branch=master)](https://travis-ci.org/carsonip/alexa-pocket)

### Alexa skill: [My Pocket: Unofficial Pocket Skill](https://www.amazon.com/My-Pocket-Unofficial-Skill/dp/B071KZFKLM)

This skill is an unofficial Alexa skill for Pocket. It is capable of:
* Retrieving the saved list of articles (with or without tag)
* Reading the article view of an article
* Performing actions on an article (Archive, Unarchive, Favorite, Unfavorite, Delete)
* Displaying the article list and content on Echo Show and other devices with display interface

## Development

The skill requires authorization from the user's Pocket account in order to work. That part of the code is not in this repository.

Pocket Article View API is private. Therefore the corresponding part of the code is stored in `src/pocket-private.js` which is not uploaded to GitHub. Please contact Pocket for access to this API.

For unit test, run `mocha`.

To test the code using ask sdk, run `node ask-test.js`.