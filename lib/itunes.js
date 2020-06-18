var crypto = require('crypto'),
    moment = require('moment'),
    https = require('https'),
    queryManager = require('querystring'),
    redis = require('redis'),
    redisClient = redis.createClient(),
    itunes = exports;

/**
 * Computes the md5sum of the given parameters object
 * @param {object} parameters Parameters to JSON encode and then md5 hashed
 * @returns {*|String} the md5sum
 */
function computeParamsHash(parameters) {
    var md5sum = crypto.createHash('md5');
    md5sum.setEncoding('binary');
    md5sum.write(JSON.stringify(parameters));
    md5sum.end();
    return new Buffer(md5sum.read(), 'binary').toString('base64');
}

itunes.search = function(opts, callback) {
    process.nextTick(function() {
        var cache;
        if(opts.hasOwnProperty("cache")) {
            cache = opts["cache"];
            delete opts["cache"];
        } else {
            // cache this for a week
            cache = 604800000;
        }

        // check if this is in the cache
        var cacheKey = "iTunesCache-" + computeParamsHash(opts);
        redisClient.get(cacheKey, function(err, reply) {
            if(reply !== null) {
                callback(JSON.parse(reply));
            } else {
                var queryString = queryManager.stringify(opts);

                https.get({
                    hostname: "itunes.apple.com",
                    path: "/search?" + queryString
                }, function(res) {
                    if(res.statusCode == 200) {
                        var responseData = "";

                        res.on('data', function(chunk) {
                            responseData += chunk;
                        });

                        res.on('end', function() {
                            // cache the response
                            if(cache > 0) {
                                redisClient.psetex(cacheKey, cache, responseData);
                            }

                            callback(JSON.parse(responseData));
                        });
                    }
                });
            }
        });
    });
}