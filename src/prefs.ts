import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import GeneralPage from "./lib/prefs/general_page.js";

import { findChildByType } from "./lib/utils/utils.js";

export default class NetbirdPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(
    window: Adw.PreferencesWindow & {
      _settings: Gio.Settings;
    },
  ): Promise<void> {
    // Create a settings object and bind the row to our key.
    // Attach the settings object to the window to keep it alive while the window is alive.
    window._settings = this.getSettings();
    window.add(new GeneralPage(window._settings));

    this._configureHeader(window);

    return Promise.resolve();
  }

  private _configureHeader(window: Adw.PreferencesWindow): void {
    const header = findChildByType(window.get_content(), Adw.HeaderBar);
    if (header) {
      const group = Gio.SimpleActionGroup.new();
      window.insert_action_group("prefs", group);

      const menu = Gio.Menu.new();
      menu.append("About", "prefs.about");

      const menuButton = Gtk.MenuButton.new();
      menuButton.set_icon_name("open-menu-symbolic");
      menuButton.set_primary(true);
      menuButton.set_tooltip_text("Menu");
      menuButton.set_menu_model(menu);
      header.pack_end(menuButton);

      const aboutAction = new Gio.SimpleAction({ name: "about" });
      aboutAction.connect("activate", () => {
        const aboutDialog = new Adw.AboutWindow({
          transient_for: window,
          modal: true,
          version: this.metadata.version ?? "unknown",
          application_name: this.metadata.name,
          developer_name: "Adfinis AG",
          developers: ["Jonah Zürcher <jonah.zuercher@adfinis.com>"],
          issue_url:
            "https://github.com/adfinis/gnome-shell-extension-netbird/issues",
          support_url:
            "https://github.com/adfinis/gnome-shell-extension-netbird/issues",
          website: this.metadata.url ?? "https://netbird.io/",
          license_type: Gtk.License.GPL_3_0,
          copyright: `© ${new Date().getFullYear().toString()} Adfinis AG`,
        });

        aboutDialog.show();
      });

      group.add_action(aboutAction);
    }
  }
}
