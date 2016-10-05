// Copyright 2015-2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const benchlib = require('./ampbench_lib.js');
const sdlib = require('./ampbench_lib_sd.js');
const handlers = require('./ampbench_handlers.js');

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// app version
//

const VERSION_STRING = '[AMPBench:v.1.0]';

function version_msg(msg){
    return VERSION_STRING + '[' + new Date().toISOString() + '] ' + msg;
}

function validator_spec_revision() {
    return '[validator-spec-revision:' + benchlib.amphtml_validator_spec_revision() + ']';
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// app validation check status constants
//

const
    CHECK_FAIL = 'FAIL',
    CHECK_PASS = 'PASS',
    CHECK_INFO = 'INFO',
    CHECK_WARN = 'WARNING',
    CHECK_NONE = 'UNKNOWN';
const // http://www.tutorialspoint.com/html/html_colors.htm
    CHECK_FAIL_CSS = '<span style="color: red; ">'       + CHECK_FAIL + '</span>',
    CHECK_PASS_CSS = '<span style="color: #41c40f; ">'   + CHECK_PASS + '</span>',
    CHECK_INFO_CSS = '<span style="color: #c530ac; ">'   + CHECK_INFO + '</span>',
    CHECK_WARN_CSS = '<span style="color: orange; ">'    + CHECK_WARN + '</span>',
    CHECK_NONE_CSS = '<span style="color: orange; ">'    + CHECK_NONE + '</span>';
const
    get_check_status_css = (status) => {
        switch(status) {
            case CHECK_FAIL: return CHECK_FAIL_CSS;
            case CHECK_PASS: return CHECK_PASS_CSS;
            case CHECK_INFO: return CHECK_INFO_CSS;
            case CHECK_WARN: return CHECK_WARN_CSS;
            default: return CHECK_NONE_CSS;
        }
    };

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// app imports, main instance and view templates
//

const os = require('os');
const fs = require('fs');
const path = require("path");
const http = require('http');
const https = require('https');
const url = require('url');
const util = require('util');
const inspect_obj = (obj) => {return util.inspect(obj, { showHidden: true, depth: null })};
const S = require('string');

const express = require('express');
const app = express();
app.use(express.static('public'));

const favicon = require('serve-favicon');
// app.use(favicon(path.join(__dirname, 'public/images', 'favicon_checklist.png')));
app.use(favicon(path.join(__dirname, 'public/images', 'amp-logo-black.png')));

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

const handlebars = require('handlebars');
const index_template = fs.readFileSync(__dirname + '/views/index.hbs', 'utf8');
const results_template = fs.readFileSync(__dirname + '/views/results.hbs', 'utf8');
// TODO: WIP20160426 - bulk support routes
// const multi_url_template = fs.readFileSync(__dirname + '/views/multi_url.hbs', 'utf8');

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ERRORS
//

// TODO? set environment variable for process.env.NODE_ENV: NODE_ENV=production

// // development error handler: will print stacktrace
// if (app.get('env') === 'development') {
//     app.use(function(err, req, res, next) {
//         res.status(err.status || 500);
//         res.render('error', {
//             message: err.message,
//             error: err
//         });
//     });
// }

// production error handler: no stacktraces leaked to user (TODO: actually, we are for now...)
app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        // error: {}
        error: err // !!!NOTE: we want this
    });
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ROUTES
//

app.get('/', (req, res) => {
    res.header("Content-Type", "text/html; charset=utf-8");
    res.write(handlebars.compile(index_template)());
    res.end();
});

app.get('/version', (req, res) => {
    let __res = handlers.version('/version', req, res);
    res.status(200).send(__res);
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

app.post('/valid', (req, res) => {
    const
        validate_url = benchlib.str_encode_hard_amp(req.body.input_url),
        validate_url_enc = encodeURIComponent(validate_url),
        forward_url = '../validate?url=' + validate_url_enc;
    res.redirect(forward_url);
});

app.get('/validate', (req, res) => {
    const query_url = req.query.url;
    const on_handler_validate = (__res) => {
        res.header("Content-Type", "text/html; charset=utf-8");
        if (__res) {
            res.write(handlebars.compile(results_template)(__res));
            res.end();
        } else {
            res.status(200).send(version_msg('No data was retrieved from AMP validation service.'));
        }
    };
    handlers.validate('/validate', req, res, on_handler_validate);
});

app.get('/raw/', (req, res) => {
    let amp_url = req.query.url || '';
    let check_http_response = null;
    if ('' == amp_url.trim()) {
        res.status(200).send(version_msg('No AMP URL parameter found.'));
    } else {
        const on_output = (http_response, output) => {
            check_http_response = http_response;
            console.log(version_msg(
                validator_spec_revision() +
                '[HTTP:' + check_http_response.http_response_code + '] ' +
                req.path + ' ' + amp_url)); //!!!USEFUL!!!
            res.status(200).send(output + os.EOL);
        };
        benchlib.api_validate_url(amp_url, on_output, 0);
    }
});

app.get('/check/', (req, res) => {
    let amp_url = req.query.url || '';
    let check_http_response = null;
    if ('' == amp_url.trim()) {
        res.status(200).send(version_msg('No AMP URL parameter found.'));
    } else {
        const on_output = (http_response, output) => {
            check_http_response = http_response;
            console.log(version_msg(
                validator_spec_revision() +
                '[HTTP:' + check_http_response.http_response_code + '] ' +
                req.path + ' ' + amp_url)); //!!!USEFUL!!!
            res.status(200).send(benchlib.multiline_to_html(output) + os.EOL);
        };
        benchlib.api_validate_url(amp_url, on_output, 0);
    }
});

//TODO // - - make into an ERROR PAGE but for now it is a debug dump route - - - - - - - - - - - - - - - - - - - - - - -
app.get('/debug/', (req, res) => {
    let amp_url = req.query.url || '';
    let check_http_response = null;
    if ('' == amp_url.trim()) {
        res.status(200).send(version_msg('No AMP URL parameter found.'));
    } else {
        const on_output = (http_response, output) => {
            check_http_response = http_response;
            console.log(version_msg(
                validator_spec_revision() +
                '[HTTP:' + check_http_response.http_response_code + '] ' +
                req.path + ' ' + amp_url)); //!!!USEFUL!!!
            res.status(200).send(benchlib.multiline_to_html(output) + os.EOL);
        };
        benchlib.api_validate_url(amp_url, on_output, 0);
    }
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// /command_force_validator_update API that hot swaps the latest CDN validator
// library into a running AMPBench instance
app.get('/command_force_validator_update', (req, res) => {
    console.log(version_msg(validator_spec_revision()));
    let __res = '[VALIDATOR REFRESH] BEFORE: ' + validator_spec_revision();
    const on_refresh_complete = (amphtml_validator_spec_file_revision) => {
        __res += ' AFTER: ' + amphtml_validator_spec_file_revision;
        console.log(__res);
        res.status(200).send(__res);
    };
    benchlib.lib_refresh_validator_if_stale(on_refresh_complete);
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// make common object group returns for JSON APIs
//

const make_api_http_response = (http_response) => {
    return {
        url: http_response.url,
        http_code: http_response.http_response_code,
        http_text: http_response.http_response_text,
        response_time_ms: http_response.duration_in_milliseconds,
        redirected: http_response.wasRedirected(),
        redirects_count: http_response.redirects_count,
        redirects_urls: http_response.redirects_urls,
        is_https: http_response.is_https,
        is_https_cert_authorized: http_response.is_https_cert_authorized,
        is_https_ssl_error: http_response.is_https_cert_ssl_error
    };
};

const make_api_amp_links = (parse_amplinks) => {
    return {
        canonical_url: parse_amplinks.canonical_url,
        amphtml_url: parse_amplinks.amphtml_url,
        amp_uses_feed: parse_amplinks.amp_uses_feed
    };
};

const make_api_sd_validation = (api_validate_sd_return) => {
    return {
        status:             api_validate_sd_return.status,
        result:             api_validate_sd_return.result,
        sd_json_error:      api_validate_sd_return.json_error,
        sd_kind:            api_validate_sd_return.kind,
        sd_type:            api_validate_sd_return.type,
        sd_type_is_amp:     api_validate_sd_return.type_is_amp,
        sd_context:         api_validate_sd_return.context,
        sd_headline:        api_validate_sd_return.news_headline,
        sd_author_name:     api_validate_sd_return.author_name,
        sd_publisher_name:  api_validate_sd_return.publisher_name,
        sd_date_published:  api_validate_sd_return.date_published,
        sd_date_modified:   api_validate_sd_return.date_modified,
        sd_logo_image:      api_validate_sd_return.image,
        sd_article:         api_validate_sd_return.article
    };
};

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// API: core: smallest (fastest?) JSON API
//

// http://localhost:8080/api?url=https://health.mail.ru/amp/news/chto_delaet_pechen/
// curl http://localhost:8080/api?url=https://health.mail.ru/amp/news/chto_delaet_pechen/
app.get('/api/', (req, res) => {
    // console.log('==> api: req.query.url: ' + req.query.url);
    let amp_url = req.query.url || '';
    // console.log('==> api: amp_url: ' + amp_url);
    let check_http_response = null;
    let parse_amplinks = {};
    if ('' == amp_url.trim()) {
        res.status(200).send(version_msg('No API URL parameter found.'));
    } else {
        var on_output = (http_response, output) => {
            check_http_response = http_response;
            var status = output.shift();
            console.log(version_msg(
                validator_spec_revision() +
                '[HTTP:' + check_http_response.http_response_code + '] ' +
                req.path + ' ' + amp_url)); //!!!USEFUL!!!
            parse_amplinks = benchlib.parse_body_for_amplinks_and_robots_metatags(check_http_response);
            app.set('json spaces', 4);
            res.status(200).json({
                status: status,
                url: amp_url,
                http_response: make_api_http_response(check_http_response),
                amp_links: make_api_amp_links(parse_amplinks),
                results: output
            });
        };
        benchlib.api_validate_url(amp_url, on_output, 1);
    }
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// API1: combine other JSON APIs: AMP + SD
//

app.get('/api1/', (req, res) => {
    let amp_url = (req.query.url).trim() || '';

    let check_http_response = null;

    let amp_status = CHECK_NONE,
        amp_validate_output = [];

    let api_validate_amp_return = null,
        api_validate_sd_return = null,
        api_validate_amp_warnings_return = null;

    let parse_amplinks = {};

    let on_api_validate_sd = (api_return) => {

        api_validate_sd_return = api_return;

        // required markup warnings - - - - - - - - - -
        amp_status = api_validate_amp_return.shift();
        amp_validate_output = api_validate_amp_return.join(os.EOL);
        api_validate_amp_warnings_return =
            benchlib.build_warning_lines_from_validation_output(amp_url, amp_validate_output, '');
        let amp_validate_warning_lines = api_validate_amp_warnings_return.amp_val_warning_lines.split('<br>');

        app.set('json spaces', 4);
        res.status(200).json({
            status: amp_status,
            url: amp_url,
            http_response: make_api_http_response(check_http_response),
            amp_links: make_api_amp_links(parse_amplinks),
            amp_required_markup: {
                status: api_validate_amp_warnings_return.amp_val_results_status,
                warning_count: api_validate_amp_warnings_return.amp_val_warnings_len,
                warning_status: api_validate_amp_warnings_return.amp_val_warning_status,
                results: amp_validate_warning_lines
            },
            amp_validation: {
                status: amp_status,
                results: api_validate_amp_return
            },
            sd_validation: make_api_sd_validation(api_validate_sd_return),
            robots: {
                robots_meta_status: parse_amplinks.check_robots_meta_status,
                robots_meta_result: parse_amplinks.check_robots_meta_result
            }
        });
    };

    let on_api_validate_amp = (http_response, api_return) => {
        check_http_response = http_response;
        console.log(version_msg(
            validator_spec_revision() +
            '[HTTP:' + check_http_response.http_response_code + '] ' +
            req.path + ' ' + amp_url)); //!!!USEFUL!!!
        api_validate_amp_return = api_return;
        // console.log('==> api_validate_amp_response_body: ' + api_validate_amp_response_body);
        parse_amplinks = benchlib.parse_body_for_amplinks_and_robots_metatags(check_http_response);
        on_api_validate_sd(sdlib.check_body_metadata(check_http_response.http_response_body));
    };

    if ('' === amp_url) {
        res.status(200).send(version_msg('No validation API URL parameter found.'));
    } else {
        benchlib.api_validate_url(amp_url, on_api_validate_amp, 1);
    }
});

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// API2: combine other JSON APIs: AMP + SD ++
//

app.get('/api2/', (req, res) => {
    let amp_url = (req.query.url).trim() || '';

    let check_http_response = null;

    let amp_status = CHECK_NONE,
        amp_validate_output = [];

    let api_validate_amp_return = '',
        api_validate_sd_return = null,
        api_validate_amp_warnings_return = null;

    let parse_amplinks = {}; // <== function parse_page_content(http_response):
        // canonical_url: '',
        // amphtml_url: '',
        // check_robots_meta_results: 'Page content could not be read.',
        // check_robots_meta_status: CHECK_FAIL,
        // check_x_robots_tag_header_results: 'Response header could not be read.',
        // check_x_robots_tag_header_status: CHECK_FAIL

    let check_amplinks = {}; // <== function review_amp_links(parse_amplinks...
        // check_extra: '',
        // check_amp_links_canonical_url: '',
        // check_amp_links_canonical_status: CHECK_NONE,
        // check_amp_links_canonical_results: '',
        // check_amp_links_amphtml_url: '',
        // check_amp_links_amphtml_status: CHECK_NONE,
        // check_amp_links_amphtml_results: ''

    let check_robots_txt_return = null,
        check_google_amp_cache_return = null;

    const make_api_response = () => {

        // required markup warnings - - - - - - - - - -
        amp_status = api_validate_amp_return.shift();
        amp_validate_output = api_validate_amp_return.join(os.EOL);
        api_validate_amp_warnings_return =
            benchlib.build_warning_lines_from_validation_output(amp_url, amp_validate_output, '');
        let amp_validate_warning_lines = api_validate_amp_warnings_return.amp_val_warning_lines.split('<br>');

        return {
            status: amp_status,
            url: amp_url,
            http_response: make_api_http_response(check_http_response),
            extra: check_amplinks.check_extra,
            amp_links: make_api_amp_links(parse_amplinks),
            amp_required_markup: {
                status: api_validate_amp_warnings_return.amp_val_results_status,
                warning_count: api_validate_amp_warnings_return.amp_val_warnings_len,
                warning_status: api_validate_amp_warnings_return.amp_val_warning_status,
                results: amp_validate_warning_lines
            },
            amp_validation: {
                status: amp_status,
                results: api_validate_amp_return
            },
            google_amp_cache: {
                status: check_google_amp_cache_return.check_google_amp_cache_status,
                result: check_google_amp_cache_return.check_google_amp_cache_results,
                google_amp_cache_url: check_google_amp_cache_return.check_google_amp_cache_url,
                google_amp_viewer_url: check_google_amp_cache_return.check_google_amp_viewer_url
            },
            robots: {
                robots_txt_status: check_robots_txt_return.check_robots_txt_status,
                robots_txt_result: check_robots_txt_return.check_robots_txt_results,
                robots_txt_url: check_robots_txt_return.check_robots_txt_file_url,
                robots_txt_googlebot_status: check_robots_txt_return.check_robots_txt_ua_googlebot_ok,
                robots_txt_googlebot_smartphone_status: check_robots_txt_return.check_robots_txt_ua_googlebot_smartphone_ok,
                robots_meta_status: parse_amplinks.check_robots_meta_status,
                robots_meta_result: parse_amplinks.check_robots_meta_results,
                x_robots_tag_header_status: parse_amplinks.check_x_robots_tag_header_status,
                x_robots_tag_header_result: parse_amplinks.check_x_robots_tag_header_results
            },
            sd_validation: make_api_sd_validation(api_validate_sd_return)
        }
    };

    let write_api_response = () => {
        app.set('json spaces', 4);
        res.status(200).json(make_api_response());
    };

    let on_api_validate_sd = (api_return) => {
        api_validate_sd_return = api_return;
        write_api_response();
    };

    let on_api_google_amp_cache = (api_return) => {
        check_google_amp_cache_return = api_return;
        on_api_validate_sd(sdlib.check_body_metadata(check_http_response.http_response_body));
    };

    let on_api_robots_txt = (api_return) => {
        check_robots_txt_return = api_return;
        benchlib.check_google_amp_cache(amp_url, on_api_google_amp_cache);
    };

    let on_api_validate_amp = (http_response, api_return) => {
        check_http_response = http_response;
        console.log(version_msg(
            validator_spec_revision() +
            '[HTTP:' + check_http_response.http_response_code + '] ' +
            req.path + ' ' + amp_url)); //!!!USEFUL!!!
        api_validate_amp_return = api_return;
        // parse_amplinks = benchlib.parse_body_for_amplinks_and_robots_metatags(check_http_response.http_response_body);
        parse_amplinks = benchlib.parse_page_content(check_http_response);
        check_amplinks = benchlib.review_amp_links(amp_url, parse_amplinks);
        benchlib.check_robots_txt(amp_url, on_api_robots_txt);
    };

    if ('' === amp_url) {
        res.status(200).send(version_msg('No validation API URL parameter found.'));
    } else {
        benchlib.api_validate_url(amp_url, on_api_validate_amp, 1);
    }
});

function print_dashes(dash_count) { // needs: const S = require('string');
    console.log(S(('- ').repeat(dash_count)).s );
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// server utilities
//

class HttpServer {
    constructor(server) {
        this._server = server;
        this._host = this._server.address().address;
        this._port = this._server.address().port;
    }
    get host() { // read-only - set during instantiation!
        return this._host;
    }
    get port() { // read-only - set during instantiation!
        return this._port;
    }
}

var __server = null;
function init_server(server) {  // called from main startup
    if (null === __server) {    // only once
        __server = new HttpServer(server);
    }
    return __server;
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// module exports
//

exports.init_server = init_server;
exports.version_msg = version_msg;
exports.app = app;

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
