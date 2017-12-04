'use strict';

var http = require('http');
var https = require('https');

var unmockHttp = require('qnit').qmock.unmockHttp;

var gm = {
    httpRequest: require('./')
};

module.exports = {
    afterEach: function(done) {
        unmockHttp();
        done();
    },

    'httpRequest': {
        'should invoke http.request': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            gm.httpRequest('http://localhost1', function(){
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    hostname: 'localhost1',
                })
                t.done();
            })
            setImmediate(function() {
            })
        },

        'should invoke https.request': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(https, 'request');
            gm.httpRequest('https://localhost2', function(){
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments, {
                    hostname: 'localhost2',
                })
                t.done();
            })
        },

        'should accept and parse string url': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            gm.httpRequest('http://usern:passw@localhost:1337/path/name?a=12&b=34#hash5', function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                });
                t.done();
            });
        },

        'should accept object url': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(http, 'request');
            var uri = { url: 'http://localhost:1337/path/name?a=12&b=34#hash5', auth: 'usern:passw', headers: { 'X-Unit-Test': '789A' } };
            gm.httpRequest(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'http:',
                    hostname: 'localhost',
                    port: 1337,
                    path: '/path/name?a=12&b=34',
                });
                t.contains(spy.callArguments[0].headers, { 'X-Unit-Test': '789A' });
                t.done();
            });
        },

        'should not set uri properties to undefined parsed properties': function(t) {
            t.mockHttp().when(/^/).send(200);
            var spy = t.spyOnce(https, 'request');
            var uri = { url: "https://otherhost:1337" };
            gm.httpRequest(uri, function(err, res, body) {
                t.equal(spy.callCount, 1);
                t.contains(spy.callArguments[0], {
                    protocol: 'https:',
                    hostname: 'otherhost'
                });
                t.ok(! ('url' in spy.callArguments[0]));
                t.ok(! ('query' in spy.callArguments[0]));
                t.ok(! ('hash' in spy.callArguments[0]));
                t.done();
            });
        },

        'should call with the parsed url properties': function(t) {
            var reqOptions;
            t.mockHttp()
                .when(/^/)
                    .compute(function(req, res, next) {
                        reqOptions = req._options;
                        next();
                    })
            ;
            var uri = { method: 'POST', protocol: 'http:', hostname: 'somehost', query: 'b=2', hash: 'somehash', other: 'other' };
            uri.url = 'https://otherhost:1337/path/name?a=1#otherhash';
            gm.httpRequest(uri, function(err, res, body) {
                t.contains(reqOptions, {
                    method: 'POST',
                    other: 'other',
                    protocol: 'https:',
                    hostname: 'otherhost',
                    port: 1337,
                    path: '/path/name?a=1',
                })
                t.done();
            })
        },

        'should accept string body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = gm.httpRequest('http://localhost', 'test req body', function(err, res, body) {
                t.equal(typeof req._mockWrites[0][0], 'string');
                t.equal(req._mockWrites[0][0], 'test req body');
                t.done();
            })
        },

        'should accept buffer body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = gm.httpRequest('http://somehost', new Buffer('test req body'), function(err, res, body) {
                t.ok(Buffer.isBuffer(req._mockWrites[0][0]));
                t.equal(String(req._mockWrites[0][0]), 'test req body');
                t.done();
            })
        },

        'should accept object body': function(t) {
            t.mockHttp().when('http://somehost').send(200);
            var req = gm.httpRequest('http://somehost', { testBody: 'test req body' }, function(err, res, body) {
                t.equal(typeof req._mockWrites[0][0], 'string');
                t.equal(req._mockWrites[0][0], JSON.stringify({ testBody: 'test req body'}));
                t.done();
            })
        },

        'should make call to all-defaults uri': function(t) {
            // the url "" is a valid url, it uses all defaults -- http://localhost:80/
            // and returns the response if there is a localhost http server running.
            // Or errors out if not.  This test just runs all branch points of the code.
            gm.httpRequest({}, function(err, res, body) {
                t.done();
            })
        },

        'should return gathered response raw': function(t) {
            t.mockHttp()
                .when('http://some/url')
                    .compute(function(req, res, next) {
                        res.emit('data', new Buffer('test '));
                        res.emit('data', new Buffer('response'));
                        res.emit('end');
                    })
            ;
            gm.httpRequest('http://some/url', function(err, res, body) {
                t.ifError(err);
                t.ok(Buffer.isBuffer(body));
                t.equal(body.toString(), 'test response');
                t.done();
            })
        },

        'should return only once': function(t) {
            t.mockHttp()
                .when('http://host/path')
                    .send(200, 'test response')
            ;
            var returnCount = 0;
            var req = gm.httpRequest('http://host/path', function(err, res, body) {
                returnCount += 1;
                t.ok(!err);
                t.equal(returnCount, 1);
                if (res) res.emit('error', new Error('not sure if res emits error'));
                if (res) res.emit('end');
                setTimeout(function(){ t.done() }, 10);
            })
            setTimeout(function(){ req.emit('error', new Error('test error')) }, 2);
            setTimeout(function(){ req.emit('error', new Error('test error')) }, 3);
        },

        'errors': {
            'should require callback': function(t) {
                try { gm.httpRequest("https://localhost") }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should require uri': function(t) {
                try { gm.httpRequest("", function(){}) }
                catch (err) {
                    t.contains(err.message, 'required');
                    t.done();
                }
            },

            'should return req errors': function(t) {
                t.mockHttp()
                    .when('http://host/path')
                        .send(200, 'test response')
                ;
                var req = gm.httpRequest('http://host/path', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.message, 'req error');
                    t.done();
                })
                req.emit('error', new Error('req error'));
            },

            'should return res errors': function(t) {
                t.mockHttp()
                    .when('http://host/path')
                    .emit('error', new Error('res error'))
                ;
                gm.httpRequest('http://host/path', function(err, res, body) {
                    t.ok(err);
                    t.equal(err.message, 'res error');
                    t.done();
                })
            },
        },
    },
};
