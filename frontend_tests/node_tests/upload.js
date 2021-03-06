set_global('$', global.make_zjquery());
set_global('document', {
    location: { },
});
set_global('i18n', global.stub_i18n);
set_global('page_params', { });
set_global('csrf_token', { });

// Setting these up so that we can test that links to uploads within messages are
// automatically converted to server relative links.
global.document.location.protocol = 'https:';
global.document.location.host = 'foo.com';

zrequire('compose_ui');
zrequire('compose_state');
zrequire('compose');
zrequire('upload');

var upload_opts = upload.options({ mode: "compose" });

(function test_upload_started() {
    $("#compose-send-button").prop('disabled', false);
    $("#compose-send-status").removeClass("alert-info").hide();
    $(".compose-send-status-close").one = function (ev_name, handler) {
        assert.equal(ev_name, 'click');
        assert(handler);
    };
    $("#compose-error-msg").html('');
    var test_html = '<div class="progress progress-striped active">' +
                    '<div class="bar" id="compose-upload-bar" style="width: 00%;">' +
                    '</div></div>';
    $("<p>").after = function (html) {
        assert.equal(html, test_html);
        return 'fake-html';
    };

    upload_opts.drop();

    assert.equal($("#compose-send-button").attr("disabled"), '');
    assert($("#compose-send-status").hasClass("alert-info"));
    assert($("#compose-send-status").visible());
    assert.equal($("<p>").text(), 'translated: Uploading…');
    assert.equal($("#compose-error-msg").html(), 'fake-html');
}());

(function test_progress_updated() {
    var width_update_checked = false;
    $("#compose-upload-bar").width = function (width_percent) {
        assert.equal(width_percent, '39%');
        width_update_checked = true;
    };
    upload_opts.progressUpdated(1, '', 39);
    assert(width_update_checked);
}());

(function test_upload_error() {
    function setup_test() {
        $("#compose-send-status").removeClass("alert-error");
        $("#compose-send-status").addClass("alert-info");
        $("#compose-send-button").attr("disabled", 'disabled');
        $("#compose-error-msg").text('');
    }

    function assert_side_effects(msg) {
        assert($("#compose-send-status").hasClass("alert-error"));
        assert(!$("#compose-send-status").hasClass("alert-info"));
        assert.equal($("#compose-send-button").prop("disabled"), false);
        assert.equal($("#compose-error-msg").text(), msg);
    }

    function test(err, msg, server_response=null, file={}) {
        setup_test();
        upload_opts.error(err, server_response, file);
        assert_side_effects(msg);
    }

    var msg_prefix = 'translated: ';
    var msg_1 = 'File upload is not yet available for your browser.';
    var msg_2 = 'Unable to upload that many files at once.';
    var msg_3 = '"foobar.txt" was too large; the maximum file size is 25MiB.';
    var msg_4 = 'Sorry, the file was too large.';
    var msg_5 = 'An unknown error occurred.';

    test('BrowserNotSupported', msg_prefix + msg_1);
    test('TooManyFiles', msg_prefix + msg_2);
    test('FileTooLarge', msg_prefix + msg_3, null, {name: 'foobar.txt'});
    test(413, msg_prefix + msg_4);
    test(400, 'ちょっと…', {msg: 'ちょっと…'});
    test('Do-not-match-any-case', msg_prefix + msg_5);
}());

(function test_upload_finish() {
    function test(i, response, textbox_val) {
        var compose_ui_autosize_textarea_checked = false;
        var compose_actions_start_checked = false;

        function setup() {
            $("#compose-textarea").val('');
            compose_ui.autosize_textarea = function () {
                compose_ui_autosize_textarea_checked = true;
            };
            compose_state.set_message_type();
            global.compose_actions = {
                start: function (msg_type) {
                    assert.equal(msg_type, 'stream');
                    compose_actions_start_checked = true;
                },
            };
            $("#compose-send-button").attr('disabled', 'disabled');
            $("#compose-send-status").addClass("alert-info");
            $("#compose-send-status").show();
            $('#file_input').clone = function (param) {
                assert(param);
                return $('#file_input');
            };
        }

        function assert_side_effects() {
            assert.equal($("#compose-textarea").val(), textbox_val);
            if (response.uri) {
                assert(compose_actions_start_checked);
                assert(compose_ui_autosize_textarea_checked);
                assert.equal($("#compose-send-button").prop('disabled'), false);
                assert(!$('#compose-send-status').hasClass('alert-info'));
                assert(!$('#compose-send-status').visible());
            }
        }

        setup();
        upload_opts.uploadFinished(i, {}, response);
        assert_side_effects();
    }

    var msg_1 = '[pasted image](https://foo.com/uploads/122456) ';
    var msg_2 = '[foobar.jpeg](https://foo.com/user_uploads/foobar.jpeg) ';

    test(-1, {}, '');
    test(-1, {uri: 'https://foo.com/uploads/122456'}, msg_1);
    test(1, {uri: '/user_uploads/foobar.jpeg'}, msg_2);
}());
