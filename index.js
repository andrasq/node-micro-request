/**
 * Copyright (C) 2017 Kinvey, Inc.
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-12-04 - AR.
 */

'use strict';

var http = require('http');
var https = require('https');
var Url = require('url');

module.exports = function request(uri, body, cb) { return request.request(uri, body, cb) };
module.exports.request = microreq;

var microreqOptions = {url:1, body:1, headers:1, noReqEnd:1, noResListen:1, encoding:1};
function tryJsonParse(str) { try { return JSON.parse(str) } catch (e) { return str.toString('utf8') } }

/*
 * make an http request, return the response
 * Very simple wrapper around http.request to make it more conveient to use.
 * Uri can be a url string or the options to pass to http.request, with a few extra
 * recognized settings eg 'url', 'body', 'encoding' (that are not passed).
 */
function microreq( uri, body, callback ) {
    if (!callback) {
        callback = body;
        body = undefined;
    }
    body = (body != undefined) ? body : (uri.body != undefined) ? uri.body : undefined;
    if (!uri || !callback) throw new Error("uri and callback required");

    var requestOptions = { headers: {} }, noReqEnd = uri.noReqEnd, noResListen = uri.noResListen, encoding = uri.encoding;
    if (typeof uri === 'object') {
        for (var k in uri) if (!(microreqOptions[k])) requestOptions[k] = uri[k];
        for (var k in uri.headers) requestOptions.headers[k] = uri.headers[k];
    }

    var urlParts, url = (typeof uri === 'string') ? uri : uri.url;
    // copy pathmame too for older qnit mockHttp(); nodejs ignores it
    if (url != undefined) for (var k in (urlParts = Url.parse(url), { protocol:1, hostname:1, port:1, path:1, pathname:1 })) {
        if (urlParts[k] != null) requestOptions[k] = urlParts[k];
    }

    body = (typeof body === 'string' || Buffer.isBuffer(body)) ? body : JSON.stringify(body);
    if (noReqEnd) requestOptions.headers['Transfer-Encoding'] = 'chunked';
    else requestOptions.headers['Content-Length'] = (typeof body === 'string') ? Buffer.byteLength(body) : body ? body.length : 0;

    var httpCaller = requestOptions.protocol === 'https:' ? https : http;
    var doneCount = 0, body;
    var req = httpCaller.request(requestOptions, function(res) {
        if (noResListen) return (!doneCount++ && callback(null, res));
        // readBody from qibl 1.5.0-pre
        var chunk1, chunks, data = '', body;
        res.on('data', function(chunk) {
            if (typeof chunk === 'string') data += chunk;
            else if (!chunk1) chunk1 = chunk;
            else if (!chunks) chunks = new Array(chunk1, chunk);
            else chunks.push(chunk);
        })
        res.on('end', function() {
            var body = !chunk1 ? data : !chunks ? chunk1 : Buffer.concat(chunks);
            if (encoding) body = (encoding === 'json') ? tryJsonParse(body) : (typeof body !== 'string') ? body.toString(encoding) : body;
            if (!doneCount++) callback(null, res, body);
        })
        res.on('error', function(err) {
            if (!doneCount++) callback(err);
        })
    })
    req.on('error', function(err) {
        if (!doneCount++) callback(err);
    })

    if (body !== undefined) req.write(body);
    if (!noReqEnd) req.end();

    return req;
}
