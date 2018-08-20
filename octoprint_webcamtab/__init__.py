# coding=utf-8
from __future__ import absolute_import

__author__ = "Sven Lohrmann <malnvenshorn@gmail.com>"
__license__ = "GNU Affero General Public License http://www.gnu.org/licenses/agpl.html"
__copyright__ = "Copyright (C) 2017 Sven Lohrmann - Released under terms of the AGPLv3 License"

import octoprint.plugin


class WebcamTabPlugin(octoprint.plugin.SettingsPlugin,
                      octoprint.plugin.AssetPlugin,
                      octoprint.plugin.TemplatePlugin):

    def get_settings_defaults(self):
        return dict(
            keycontrolEnabled = True,
        )

	def on_settings_save(self, data):
		s = self._settings
		if "keycontrolEnabled" in data.keys():
			s.setBoolean(["keycontrolEnabled"], data["keycontrolEnabled"])
		s.save()

    # AssetPlugin mixin

    def get_assets(self):
        return dict(
            less=["less/webcamtab.less"],
            js=["js/webcamtab.js"]
        )

    # TemplatePlugin

    def get_template_configs(self):
        return [
            dict(type="tab", name="Webcam", template="webcam_tab.jinja2", custom_bindings=True),
            dict(type="settings", name="Webcam Tab", template="webcamtab_settings.jinja2", custom_bindings=True)
		]

    # Softwareupdate hook

    def get_update_information(self):
        return dict(
            webcamtab=dict(
                displayName="Webcam Tab",
                displayVersion=self._plugin_version,

                # version check: github repository
                type="github_release",
                user="breadbakerman",
                repo="OctoPrint-WebcamTab",
                current=self._plugin_version,

                # update method: pip
                pip="https://github.com/breadbakerman/OctoPrint-WebcamTab/archive/{target_version}.zip"
            )
        )


__plugin_name__ = "Webcam Tab"


def __plugin_load__():
    global __plugin_implementation__
    __plugin_implementation__ = WebcamTabPlugin()

    global __plugin_hooks__
    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }
