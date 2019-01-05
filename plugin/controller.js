/**
 * Created by Nicolas on 10/21/15.
 */
(function (Controller) {
    'use strict';

    var async    = require('async'),

        database = require('./database'),
        logger   = require('./logger'),
        rules    = require('./rules');

    Controller.createRule = function (payload, done) {
        async.series([
            async.apply(database.createRule, payloadToRule(payload)),
            async.apply(rules.invalidate)
        ], done);
    };

    Controller.deleteRule = function (rule, done) {
        async.series([
            async.apply(database.deleteRule, rule.rid),
            async.apply(rules.invalidate)
        ], function (error) {
            if (error) {
                return done(error);
            }

            done(null, rule);
        });
    };

    Controller.getAllRules = function (done) {
        database.getRules(done);
    };

    Controller.installDefaultRules = function (done) {
        var data = require('../data/default-rules');
        var installed = [];

        async.waterfall([
            async.apply(database.getRules),
            function (rules, callback) {
                var toInstall = [], i = 0, len = data.rules.length, defaultRule;

                for (i; i < len; ++i) {
                    defaultRule = data.rules[i];
                    if (isInList('name', defaultRule.name, rules)) {
                        logger.log('verbose', 'Rule "%s" is skipped. Reason: already installed', defaultRule.displayName);
                    } else {
                        toInstall.push(defaultRule);
                    }
                }

                callback(null, toInstall);
            },
            function (install, callback) {
                async.eachSeries(install, function (defaultRule, next) {
                    database.createRule(payloadToRule(defaultRule), function (error) {
                        if (error) {
                            return next(error);
                        }
                        installed.push(defaultRule);
                        next();
                    });
                }, callback);
            },
            function (callback) {
                if (installed.length > 0) {
                    rules.invalidate(callback);
                } else {
                    callback(null);
                }
            }
        ], function (error) {
            if (error) {
                return done(error);
            }

            done(null, installed.map(function (rule) {
                return rule.displayName;
            }));
        });
    };

})(module.exports);