const assert = require('assert');

const utils = require('../utils');

describe('paragraphing', function () {
    describe('simple html', function () {
        it('should return 1 paragraph with content', function () {
            const text = '<div>foo</div>';
            assert.deepEqual(utils.getParagraphs(text), ['foo']);
        });
    });
    describe('inline element', function () {
        it('should return 1 paragraph without spacing', function () {
            const text = '<div>foo<span>bar</span></div>';
            assert.deepEqual(utils.getParagraphs(text), ['foobar']);
        });
    });
    describe('block element', function () {
        it('should return 3 paragraphs', function () {
            const text = '<div>foo<div>bar</div><div>baz</div></div>';
            assert.deepEqual(utils.getParagraphs(text), ['foo', 'bar', 'baz']);
        });
    });
    describe('ordered list', function () {
        it('should return paragraphs with numberings', function () {
            const text = '<div><ol><li>one</li><li>two</li><li>three</li></ol></div>';
            assert.deepEqual(utils.getParagraphs(text), ['1: one', '2: two', '3: three']);
        });
    });
    describe('unordered list', function () {
        it('should return a paragraph for each item', function () {
            const text = '<div><ul><li>one</li><li>two</li><li>three</li></ul></div>';
            assert.deepEqual(utils.getParagraphs(text), ['one', 'two', 'three']);
        });
    });
    describe('nested block and inline element', function () {
        it('should return paragraphs', function () {
            const text = '<div><section><div>hello <a href="world">world</a><div>foo</div><span>a</span><span>b</span></section></div>';
            assert.deepEqual(utils.getParagraphs(text), ['hello world', 'foo', 'ab']);
        });
    });
});
