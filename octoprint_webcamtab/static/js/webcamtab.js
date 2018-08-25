/*
 * View model for OctoPrint-WebcamTab
 *
 * Author: Sven Lohrmann
 * License: AGPLv3
 */
$(function() {
    function WebcamTabViewModel(parameters) {
        var self = this;

        self.control = parameters[0];
        self.loginState = parameters[1];
        self.settings = parameters[2];
        
        self.status = ko.observable(undefined);

        self.isPlayStateLoading = ko.observable(undefined);
        self.isPlayStateLoading(false);
        self.isRecordStateLoading = ko.observable(undefined);
        self.isRecordStateLoading(false);
        self.isSnapshotLoading = ko.observable(undefined);
        self.isSnapshotLoading(false);
        self.showSnapshot = ko.observable(undefined);
        self.showSnapshot(false);
        self.showSnapshotTimeout = null;
        self.showPlayStateTimeout = null;
        self.showRecordStateTimeout = null;

        self.isKeycontrolPossible = ko.pureComputed(function () {
            return self.control.settings.feature_keyboardControl() && self.control.isOperational() && !self.control.isPrinting() && self.loginState.isUser() && !$.browser.mobile;
        });
        self.isKeycontrolActive = ko.observable(undefined);
        self.isKeycontrolEnabled = ko.observable(undefined);

        self.webcamDisableTimeout = undefined;
        self.webcamLoaded = ko.observable(false);
        self.webcamError = ko.observable(false);
        
        self.showKeycontrolHelp = ko.observable(undefined);

        self.onTabChange = function (current, previous) {
            if (current == "#tab_plugin_webcamtab") {
                self._enableWebcam();
                self.isKeycontrolActive(true);
            } else if (previous == "#tab_plugin_webcamtab") {
                self._disableWebcam();
                self.isKeycontrolActive(false);
            }
        };

        self.onBrowserTabVisibilityChange = function(status) {
            if (status) {
                self._enableWebcam();
            } else {
                self._disableWebcam();
            }
        };

        self.onAfterBinding = function() {
            var tab = $('#tab_plugin_webcamtab .webcamtab_container');
            var webcam = $('#webcam_container');
            if (webcam) {
                webcam.next().remove();
                webcam.remove();
                /*
                var hint = webcam.next();
                tab.append(webcam.detach());
                if (hint && hint.attr('data-bind') === 'visible: keycontrolPossible') {
                    tab.append(hint.detach());
                }
                */
            }

            $('<li id="navbar_recording" title="Webcam aktiviert"><a href="#tab_plugin_webcamtab"><i class="fa"></i></a></li>').insertBefore('#navbar_plugin_psucontrol');

            self.showKeycontrolHelp(false);
            self.isKeycontrolEnabled(localStorage.getItem('webcamtab.keycontrolEnabled') != 'false');
            
            $('#tab_plugin_webcamtab .btn.btn-keycontrol').on('mouseover mouseout click', self.toggleKeycontrolHelp);
        };

        self._disableWebcam = function() {
            // safari bug doesn't release the mjpeg stream, so we just disable this for safari.
            if (OctoPrint.coreui.browser.safari) {
                return;
            }

            var timeout = self.control.settings.webcam_streamTimeout() || 5;
            self.webcamDisableTimeout = setTimeout(function () {
                $("#tab_plugin_webcamtab .webcam_image").attr("src", "");
                self.webcamLoaded(false);
            }, timeout * 1000);
        };

        self._enableWebcam = function() {
            if (OctoPrint.coreui.selectedTab != "#tab_plugin_webcamtab" || !OctoPrint.coreui.browserTabVisible) {
                return;
            }

            if (self.webcamDisableTimeout != undefined) {
                clearTimeout(self.webcamDisableTimeout);
            }
            var webcamImage = $("#tab_plugin_webcamtab .webcam_image");
            var currentSrc = webcamImage.attr("src");

            // safari bug doesn't release the mjpeg stream, so we just set it up the once
            if (OctoPrint.coreui.browser.safari && currentSrc != undefined) {
                return;
            }

            var newSrc = self.control.settings.webcam_streamUrl();
            if (currentSrc != newSrc) {
                if (newSrc.lastIndexOf("?") > -1) {
                    newSrc += "&";
                } else {
                    newSrc += "?";
                }
                newSrc += new Date().getTime();

                self.webcamLoaded(false);
                self.webcamError(false);
                webcamImage.attr("src", newSrc);
            }
        };

        self.webcamRatioClass = ko.pureComputed(function() {
            if (self.control.settings.webcam_streamRatio() == "4:3") {
                return "ratio43";
            } else {
                return "ratio169";
            }
        });

        self.onWebcamLoaded = function() {
            if (self.webcamLoaded()) return;

            self.webcamLoaded(true);
            self.webcamError(false);
            self.updateStatus();
        };

        self.onWebcamErrored = function() {
            self.webcamLoaded(false);
            self.webcamError(true);
            self.updateStatus();
        };

        self.reloadStream = function () {
            self._enableWebcam();
        };
        
        self.toggleKeyboard = function () {
            self.isKeycontrolEnabled(!self.isKeycontrolEnabled());
            localStorage.setItem('webcamtab.keycontrolEnabled', self.isKeycontrolEnabled());
        };

        self.toggleKeycontrolHelp = function (event) {
            self.showKeycontrolHelp(event.type == 'mouseout' ? false : self.isKeycontrolEnabled());
        }

        self.updateStatus = function (callback) {
            $.ajax('//'+location.hostname+'/webcam/status.php').done(function (data) {
                switch (data.status) {
                    case 'streaming':
                        $('#navbar_recording').removeClass('rec').fadeIn();
                        break;
                    case 'recording':
                        $('#navbar_recording').addClass('rec').fadeIn();
                        break;
                    default:
                        $('#navbar_recording').fadeOut();
                        break;
                }
                self.status(data.status);
                if (typeof(callback) === 'function') {
                    callback();
                }
            });
        };

        self.takeSnapshot = function () {
            if (!self.isSnapshotLoading()) {
                self.isSnapshotLoading(true);
                self.showSnapshot(false);
                clearTimeout(self.showSnapshotTimeout);
                self.updateStatus(function () {
                    var live = self.status() !== 'off' ? '?live' : '';
                    $.get(location.protocol + '//' + location.hostname + '/webcam/snapshot.php' + live).done(function (data) {
                        self.isSnapshotLoading(false);
                        var img = $('#tab_plugin_webcamtab .webcam_snapshot img');
                        $(img).attr('src', location.protocol + '//' + location.hostname + '/' + data.file);
                    });
                }.bind(this));
            }
        };

        self.refreshPlayState = function (data) {
            self.reloadStream();
            self.showPlayStateTimeout = setTimeout(function () {
                self.isPlayStateLoading(false);
            }, 1000);
        };

        self.refreshRecordState = function (data) {
            self.reloadStream();
            self.showRecordStateTimeout = setTimeout(function () {
                self.isRecordStateLoading(false);
            }, 1000);
        };
        
        self.startStream = function () {
            self.isPlayStateLoading(true);
            clearTimeout(self.showPlayStateTimeout);
            $.get(location.protocol + '//' + location.hostname + '/webcam/webcam.php?cmd=start').done(self.refreshPlayState.bind(this));
        };

        self.stopStream = function () {
            self.isPlayStateLoading(true);
            clearTimeout(self.showPlayStateTimeout);
            $.get(location.protocol + '//' + location.hostname + '/webcam/webcam.php?cmd=stop').done(self.refreshPlayState.bind(this));
        }

        self.startRecording = function () {
            self.isRecordStateLoading(true);
            clearTimeout(self.showRecordStateTimeout);
            $.get(location.protocol + '//' + location.hostname + '/webcam/webcam.php?cmd=record').done(self.refreshRecordState.bind(this));
        };

        self.stopRecording = function () {
            self.isRecordStateLoading(true);
            clearTimeout(self.showRecordStateTimeout);
            $.get(location.protocol + '//' + location.hostname + '/webcam/webcam.php?cmd=recordstop').done(self.refreshRecordState.bind(this));
        };

        self.onSnapshotLoaded = function () {
            self.showSnapshot(true);
            self.showSnapshotTimeout = setTimeout(function () {
                self.showSnapshot(false);
            }, 5000);
        };

        $(window).on('keydown', function () {
            if (self.isKeycontrolActive() && self.isKeycontrolEnabled() && self.isKeycontrolPossible()) {
                if (!self.control.settings.feature_keyboardControl()) return;

                var button = undefined;
                var visualizeClick = true;

                switch (event.which) {
                    case 37: // left arrow key
                        // X-
                        button = $("#control-xdec");
                        break;
                    case 38: // up arrow key
                        // Y+
                        button = $("#control-yinc");
                        break;
                    case 39: // right arrow key
                        // X+
                        button = $("#control-xinc");
                        break;
                    case 40: // down arrow key
                        // Y-
                        button = $("#control-ydec");
                        break;
                    case 49: // number 1
                    case 97: // numpad 1
                        // Distance 0.1
                        button = $("#control-distance01");
                        visualizeClick = false;
                        break;
                    case 50: // number 2
                    case 98: // numpad 2
                        // Distance 1
                        button = $("#control-distance1");
                        visualizeClick = false;
                        break;
                    case 51: // number 3
                    case 99: // numpad 3
                        // Distance 10
                        button = $("#control-distance10");
                        visualizeClick = false;
                        break;
                    case 52: // number 4
                    case 100: // numpad 4
                        // Distance 100
                        button = $("#control-distance100");
                        visualizeClick = false;
                        break;
                    case 33: // page up key
                    case 87: // w key
                        // z lift up
                        button = $("#control-zinc");
                        break;
                    case 34: // page down key
                    case 83: // s key
                        // z lift down
                        button = $("#control-zdec");
                        break;
                    case 36: // home key
                        // xy home
                        button = $("#control-xyhome");
                        break;
                    case 35: // end key
                        // z home
                        button = $("#control-zhome");
                        break;
//                    default:
//                        event.preventDefault();
//                        return false;
                }

                if (button !== undefined) {
                //if (button === undefined) {
                //    return false;
                //} else {
                    event.preventDefault();
                    if (visualizeClick) {
                        button.addClass("active");
                        setTimeout(function () {
                            button.removeClass("active");
                        }, 150);
                    }
                    button.click();
                }
            }
        });
    };

    OCTOPRINT_VIEWMODELS.push({
        construct: WebcamTabViewModel,
        dependencies: ["controlViewModel", "loginStateViewModel", "settingsViewModel"],
        elements: ["#tab_plugin_webcamtab"]
    });
});
