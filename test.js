const assert = require('assert');
const execSync = require('child_process').execSync;

function test(command, testFunc) {
    let stdout = execSync(command);
    testFunc(stdout);
}

const tests = [
    [
        'ask simulate -l en-US -t "ask my pocket what is in my pocket"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
            assert(resp.result.skillExecutionInfo.invocationResponse.body.response.outputSpeech.ssml.startsWith('<speak> Here'));
        }
    ],
    [
        // the command is stateful
        'ask simulate -l en-US -t "one"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
        }
    ],
    [
        'ask simulate -l en-US -t "ask my pocket what is in my pocket with tag alexa"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
            assert(resp.result.skillExecutionInfo.invocationResponse.body.response.outputSpeech.ssml.startsWith('<speak> Here'));
            assert(resp.result.skillExecutionInfo.invocationResponse.body.response.outputSpeech.ssml.split(':', 1)[0].includes('tag'));
        }
    ],
    [
        // the command is stateful
        'ask simulate -l en-US -t "one"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
        }
    ],
    [
        'ask simulate -l en-US -t "ask my pocket what is in my pocket"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
            assert(resp.result.skillExecutionInfo.invocationResponse.body.response.outputSpeech.ssml.startsWith('<speak> Here'));
        }
    ],
    [
        // the command is stateful
        'ask simulate -l en-US -t "next"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
        }
    ],
    [
        'ask simulate -l en-US -t "ask my pocket for an article"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
        }
    ],
    [
        'ask simulate -l en-US -t "ask my pocket for an article with tag alexa"',
        function (out) {
            assert(out);
            resp = JSON.parse(out);
            assert(resp.status === 'SUCCESSFUL');
            assert(!resp.result.error);
        }
    ]
]

tests.map((x) => test(...x))