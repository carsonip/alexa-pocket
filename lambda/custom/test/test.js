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

describe('compression', function () {
    describe('compression and decompression', function () {
        it('should return same content', function () {
            const text = '<div>foo</div>';
            assert.deepEqual(utils.decompress(utils.compress(text)), text);
        });
    });
    describe('undefined and null handling', function () {
        it('should return undefined for undefined and null', function () {
            assert.deepEqual(utils.compress(undefined), undefined);
            assert.deepEqual(utils.decompress(undefined), undefined);
            assert.deepEqual(utils.compress(null), undefined);
            assert.deepEqual(utils.decompress(null), undefined);
        });
    });
});

describe('chunking', function () {
    describe('divideContent simple', function () {
        it('should return 1 chunk', function () {
            assert.deepEqual(utils.divideContent(['a', 'b'], 2), [['a', 'b']]);
        });
    });
    describe('divideContent divide', function () {
        it('should return 2 chunks', function () {
            assert.deepEqual(utils.divideContent(['a', 'b'], 1), [['a'], ['b']]);
        });
    });
    describe('divideContent long paragraph', function () {
        it('should return 1 chunk', function () {
            assert.deepEqual(utils.divideContent(['ab', 'cd'], 1), [['ab'], ['cd']]);
        });
    });
    describe('divideContent non-trivial case', function () {
        it('should return correct chunks', function () {
            let input = ['abc', 'd', 'ef', 'ghi', 'jklmn', 'o'];
            assert.deepEqual(utils.divideContent(input, 4), [['abc', 'd'], ['ef'], ['ghi'], ['jklmn'], ['o']]);
        });
    });
});
