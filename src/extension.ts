import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as QuickSettings from "resource:///org/gnome/shell/ui/quickSettings.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import GObject from "gi://GObject";
import GLib from "gi://GLib";

import { NotificationManager } from "./lib/notify/notify.js";
import {
  NetbirdClient,
  NetbirdState,
  NetbirdConnectionOptions,
  NetbirdNetwork,
} from "./lib/netbird/netbird.js";
import { SettingsKeys } from "./lib/settings/settings.js";
import { getIconFromFile } from "./lib/utils/utils.js";

const NetbirdMenuToggle = GObject.registerClass(
  class NetbirdMenuToggle extends QuickSettings.QuickMenuToggle {
    private _client: NetbirdClient;
    private _settings: Gio.Settings;
    private _notificationManager: NotificationManager;
    private _updateTimeout: number | null = null;
    private _operationInProgress = false;
    private _clickHandlerId: number | null = null;
    private _connectionItem: PopupMenu.PopupMenuItem | null = null;
    private _vpnSection: PopupMenu.PopupMenuSection;
    private _networksSection: PopupMenu.PopupMenuSection | null = null;
    private _networksSubMenu: PopupMenu.PopupSubMenuMenuItem | null = null;
    private _extension: Extension;
    private _notificationAddedId: number | null = null;
    private _suppressNextNetworkError = false;

    constructor(
      client: NetbirdClient,
      settings: Gio.Settings,
      notificationManager: NotificationManager,
      extension: Extension,
    ) {
      super({
        title: "NetBird",
        toggleMode: true,
      });

      this._client = client;
      this._settings = settings;
      this._notificationManager = notificationManager;
      this._extension = extension;

      // Set up the menu header
      this.gicon = getIconFromFile(
        this._extension.metadata,
        "network-shield-symbolic",
      );
      this.menu.setHeader(this.gicon, "NetBird");

      // Add the VPN connection section
      this._vpnSection = new PopupMenu.PopupMenuSection();
      this._connectionItem = new PopupMenu.PopupMenuItem("Not Connected");
      this._connectionItem.sensitive = false;
      this._vpnSection.addMenuItem(this._connectionItem);
      this.menu.addMenuItem(this._vpnSection);

      // Add the networks submenu section
      this._networksSection = new PopupMenu.PopupMenuSection();
      this._networksSubMenu = new PopupMenu.PopupSubMenuMenuItem("Networks");
      this._networksSection.addMenuItem(this._networksSubMenu);
      this.menu.addMenuItem(this._networksSection);

      // Add separator and settings button
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this.menu.addAction("Settings", () => {
        this._extension.openPreferences();
      });
    }

    async initialize(): Promise<void> {
      // Show loading state immediately
      this.subtitle = "Loading...";
      this.gicon = getIconFromFile(
        this._extension.metadata,
        "network-shield-dots-symbolic",
      );
      this.menu.setHeader(this.gicon, "NetBird");
      this.checked = false;
      if (this._connectionItem) {
        this._connectionItem.label.text = "Loading...";
      }

      // Set up notification filter to suppress network errors during disconnect
      this._setupNotificationFilter();

      // Connect the click handler before checking status
      this._clickHandlerId = this.connect("clicked", () => {
        void this._onToggleClicked();
      });

      // Now check initial status
      await this._updateStatus();

      // Load networks list
      await this._updateNetworks();
    }

    private _setupNotificationFilter(): void {
      // Hook into the notification system to filter out network errors during disconnect
      const messageTray = Main.messageTray;

      console.log("[NetBird] Setting up notification filter");

      this._notificationAddedId = messageTray.connect(
        "source-added",
        (_tray: typeof messageTray, source: MessageTray.Source) => {
          try {
            // Debug: log when a new source is added
            const sourceTitle = source.title || "Unknown";
            console.log(
              `[NetBird] New notification source added: ${sourceTitle}`,
            );

            // Only monitor System notification source (where network errors come from)
            if (sourceTitle !== "System") {
              console.debug(
                `[NetBird] Ignoring non-System notification source: ${sourceTitle}`,
              );
              return;
            }

            // Monitor notifications from the System source
            const notificationAddedId = source.connect(
              "notification-added",
              (
                _source: MessageTray.Source,
                notification: MessageTray.Notification,
              ) => {
                try {
                  const notifTitle = notification.title ?? "No Title";
                  console.log(
                    `[NetBird] System notification added: ${notifTitle}`,
                  );

                  // Only suppress if we just initiated a disconnect
                  if (this._suppressNextNetworkError) {
                    const title = notifTitle.toLowerCase();

                    if (
                      (title.includes("connection") &&
                        title.includes("failed")) ||
                      (title.includes("network") && title.includes("failed")) ||
                      title.includes("disconnected")
                    ) {
                      console.log(
                        "[NetBird] Suppressing network error notification from disconnect",
                      );

                      // Defer destruction to the next idle cycle to let GNOME Shell finish
                      // processing the notification-added signal first
                      GLib.idle_add(GLib.PRIORITY_HIGH, () => {
                        try {
                          const isDestroyed = (
                            notification as unknown as {
                              _isDestroyed?: boolean;
                            }
                          )._isDestroyed;
                          if (!isDestroyed) {
                            notification.destroy();
                            console.log(
                              "[NetBird] Successfully destroyed notification",
                            );
                          }
                        } catch (err) {
                          const errMsg =
                            err instanceof Error ? err.message : String(err);
                          console.log(
                            `[NetBird] Error destroying notification: ${errMsg}`,
                          );
                        }
                        return GLib.SOURCE_REMOVE;
                      });

                      // Reset the flag after 10 seconds to allow normal notifications again
                      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
                        console.log("[NetBird] Resetting suppression flag");
                        this._suppressNextNetworkError = false;
                        return GLib.SOURCE_REMOVE;
                      });
                    }
                  }
                } catch (err) {
                  const errMsg =
                    err instanceof Error ? err.message : String(err);
                  console.log(
                    `[NetBird] Error in notification-added handler: ${errMsg}`,
                  );
                }
              },
            );

            // Clean up when source is destroyed
            source.connect("destroy", () => {
              try {
                if (notificationAddedId) {
                  source.disconnect(notificationAddedId);
                }
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                console.log(`[NetBird] Error cleaning up source: ${errMsg}`);
              }
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`[NetBird] Error in source-added handler: ${errMsg}`);
          }
        },
      );
    }

    private _cleanupNotificationFilter(): void {
      if (this._notificationAddedId !== null) {
        const messageTray = Main.messageTray;
        messageTray.disconnect(this._notificationAddedId);
        this._notificationAddedId = null;
      }
    }

    private async _updateNetworks(): Promise<void> {
      if (!this._networksSubMenu) return;

      try {
        const options = this._getConnectionOptions();
        const result = await this._client.listNetworks(options);

        // Clear existing network items
        this._networksSubMenu.menu.removeAll();

        if (!result.success || result.networks.length === 0) {
          const emptyItem = new PopupMenu.PopupMenuItem(
            result.success
              ? "No networks available"
              : "Failed to load networks",
          );
          emptyItem.sensitive = false;
          this._networksSubMenu.menu.addMenuItem(emptyItem);
          return;
        }

        for (const network of result.networks) {
          const displayName = network.id.trim();
          const description = network.domains ?? network.network;
          const label = description
            ? `${displayName}  (${description})`
            : displayName;

          const item = new PopupMenu.PopupSwitchMenuItem(
            label,
            network.selected,
          );

          // Override activate to prevent the menu from closing on toggle
          item.activate = () => {
            item.toggle();
          };

          const toggleHandlerId = item.connect(
            "toggled",
            (switchItem: PopupMenu.PopupSwitchMenuItem, state: boolean) => {
              void this._onNetworkToggled(
                network,
                state,
                switchItem,
                toggleHandlerId,
              );
            },
          );

          this._networksSubMenu.menu.addMenuItem(item);
        }
      } catch (e) {
        console.error("[NetBird] Failed to update networks:", e);
        this._networksSubMenu.menu.removeAll();
        const errorItem = new PopupMenu.PopupMenuItem("Error loading networks");
        errorItem.sensitive = false;
        this._networksSubMenu.menu.addMenuItem(errorItem);
      }
    }

    private async _onNetworkToggled(
      network: NetbirdNetwork,
      state: boolean,
      item: PopupMenu.PopupSwitchMenuItem,
      handlerId: number,
    ): Promise<void> {
      try {
        const options = this._getConnectionOptions();
        let result;

        if (state) {
          result = await this._client.selectNetwork(network.id, options);
        } else {
          result = await this._client.deselectNetwork(network.id, options);
        }

        if (result.success) {
          const action = state ? "selected" : "deselected";
          console.log(
            `[NetBird] Network "${network.id}" ${action} successfully`,
          );
        } else {
          const action = state ? "select" : "deselect";
          this._notificationManager.notifyError(
            `Failed to ${action} network "${network.id}": ${result.error ?? "Unknown error"}`,
          );
          // Block the signal to prevent retriggering, then revert the toggle
          item.block_signal_handler(handlerId);
          item.setToggleState(!state);
          item.unblock_signal_handler(handlerId);
        }
      } catch (e) {
        this._notificationManager.notifyError(
          e instanceof Error ? e.message : String(e),
        );
        // Block the signal to prevent retriggering, then revert the toggle
        item.block_signal_handler(handlerId);
        item.setToggleState(!state);
        item.unblock_signal_handler(handlerId);
      }
    }

    private async _onToggleClicked(): Promise<void> {
      // Prevent concurrent operations
      if (this._operationInProgress) {
        // Revert the toggle to its previous state
        this._setToggleState(!this.checked);
        return;
      }

      this._operationInProgress = true;

      // Remember what state the user clicked to (before we change the UI)
      const targetState = this.checked;

      // Show loading state
      this._setUILoading();

      try {
        if (targetState) {
          // Toggle is now ON, user wants to CONNECT
          await this._handleConnect();
        } else {
          // Toggle is now OFF, user wants to DISCONNECT
          await this._handleDisconnect();
        }
      } catch (e) {
        this._notificationManager.notifyError(
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        this._operationInProgress = false;
        // Always refresh status after any operation
        await this._updateStatus();
      }
    }

    private _getConnectionOptions(): NetbirdConnectionOptions {
      // Helper to get non-empty string or undefined
      const getString = (key: string): string | undefined => {
        const value = this._settings.get_string(key);
        return value && value.trim() !== "" ? value : undefined;
      };

      return {
        // Global flags
        managementUrl: getString(SettingsKeys.General.ManagementUrl),
        adminUrl: getString(SettingsKeys.General.AdminUrl),
        anonymize: this._settings.get_boolean(SettingsKeys.General.Anonymize),
        daemonAddr: getString(SettingsKeys.General.DaemonAddr),
        hostname: getString(SettingsKeys.General.Hostname),
        logFile: getString(SettingsKeys.General.LogFile),
        logLevel: getString(SettingsKeys.General.LogLevel),
        presharedKey: getString(SettingsKeys.General.PresharedKey),
        service: getString(SettingsKeys.General.Service),
        setupKey: getString(SettingsKeys.General.SetupKey),
        setupKeyFile: getString(SettingsKeys.General.SetupKeyFile),

        // Connection Settings
        allowServerSsh: this._settings.get_boolean(
          SettingsKeys.Up.AllowServerSsh,
        ),
        blockInbound: this._settings.get_boolean(SettingsKeys.Up.BlockInbound),
        blockLanAccess: this._settings.get_boolean(
          SettingsKeys.Up.BlockLanAccess,
        ),
        disableAutoConnect: this._settings.get_boolean(
          SettingsKeys.Up.DisableAutoConnect,
        ),

        // Route Settings
        disableClientRoutes: this._settings.get_boolean(
          SettingsKeys.Up.DisableClientRoutes,
        ),
        disableServerRoutes: this._settings.get_boolean(
          SettingsKeys.Up.DisableServerRoutes,
        ),

        // DNS Settings
        disableDns: this._settings.get_boolean(SettingsKeys.Up.DisableDns),
        dnsResolverAddress: getString(SettingsKeys.Up.DnsResolverAddress),
        dnsRouterInterval: getString(SettingsKeys.Up.DnsRouterInterval),
        extraDnsLabels: getString(SettingsKeys.Up.ExtraDnsLabels),

        // Firewall Settings
        disableFirewall: this._settings.get_boolean(
          SettingsKeys.Up.DisableFirewall,
        ),

        // Advanced Network Settings
        interfaceName: getString(SettingsKeys.Up.InterfaceName),
        mtu: this._settings.get_uint(SettingsKeys.Up.Mtu),
        wireguardPort: this._settings.get_uint(SettingsKeys.Up.WireguardPort),
        externalIpMap: getString(SettingsKeys.Up.ExternalIpMap),
        extraIfaceBlacklist: getString(SettingsKeys.Up.ExtraIfaceBlacklist),
        networkMonitor: this._settings.get_boolean(
          SettingsKeys.Up.NetworkMonitor,
        ),

        // Experimental Features
        enableLazyConnection: this._settings.get_boolean(
          SettingsKeys.Up.EnableLazyConnection,
        ),
        enableRosenpass: this._settings.get_boolean(
          SettingsKeys.Up.EnableRosenpass,
        ),
        rosenpassPermissive: this._settings.get_boolean(
          SettingsKeys.Up.RosenpassPermissive,
        ),

        // Authentication Settings
        noBrowser: this._settings.get_boolean(SettingsKeys.Up.NoBrowser),
        profile: getString(SettingsKeys.Up.Profile),
      };
    }

    private async _handleConnect(): Promise<void> {
      // Check if login is needed first
      const options = this._getConnectionOptions();
      const status = await this._client.getStatus(options);

      if (status.state === NetbirdState.NEEDS_LOGIN) {
        const result = await this._client.connect(options);

        if (result.success) {
          const urlRegex = /https?:\/\/[^\s]+/;
          const urlMatch = urlRegex.exec(result.output);
          if (urlMatch) {
            this._notificationManager.notifyWarning(
              "NetBird Login Required",
              `Please login in your browser:\n${urlMatch[0]}`,
            );
          } else if (result.output.includes("Connected")) {
            this._notificationManager.notifySuccess(
              "NetBird",
              "Connected to NetBird",
            );
          }
        } else {
          this._notificationManager.notifyError(
            `Failed to connect: ${result.error ?? "Unknown error"}`,
          );
        }
      } else {
        const result = await this._client.connect(options);
        if (result.success) {
          this._notificationManager.notifySuccess(
            "NetBird",
            "Connected to NetBird",
          );
        } else {
          this._notificationManager.notifyError(
            `Failed to connect: ${result.error ?? "Unknown error"}`,
          );
        }
      }
    }

    private async _handleDisconnect(): Promise<void> {
      // Set flag to suppress the next network error notification
      this._suppressNextNetworkError = true;

      const options = this._getConnectionOptions();
      const result = await this._client.disconnect(options);

      if (result.success) {
        this._notificationManager.notifySuccess(
          "NetBird",
          "Disconnected from NetBird",
        );
      } else {
        // If disconnect failed, don't suppress the error
        this._suppressNextNetworkError = false;
        this._notificationManager.notifyError(
          `Failed to disconnect: ${result.error ?? "Unknown error"}`,
        );
      }

      // Reset flag after 5 seconds if it wasn't already reset
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
        this._suppressNextNetworkError = false;
        return GLib.SOURCE_REMOVE;
      });
    }

    private _setUILoading(): void {
      // Block the signal temporarily while we update UI
      if (this._clickHandlerId !== null) {
        this.block_signal_handler(this._clickHandlerId);
      }

      this.subtitle = "Loading...";
      this.gicon = getIconFromFile(
        this._extension.metadata,
        "network-shield-dots-symbolic",
      );
      this.menu.setHeader(this.gicon, "NetBird");
      if (this._connectionItem) {
        this._connectionItem.label.text = "Loading...";
      }

      // Unblock the signal
      if (this._clickHandlerId !== null) {
        this.unblock_signal_handler(this._clickHandlerId);
      }
    }

    private _setToggleState(checked: boolean): void {
      // Block the signal temporarily while we update the toggle
      if (this._clickHandlerId !== null) {
        this.block_signal_handler(this._clickHandlerId);
      }

      this.checked = checked;

      // Unblock the signal
      if (this._clickHandlerId !== null) {
        this.unblock_signal_handler(this._clickHandlerId);
      }
    }

    private async _updateStatus(): Promise<void> {
      // Don't update if an operation is in progress
      if (this._operationInProgress) {
        return;
      }

      try {
        const options = this._getConnectionOptions();
        const status = await this._client.getStatus(options);

        // Block signals while updating UI
        if (this._clickHandlerId !== null) {
          this.block_signal_handler(this._clickHandlerId);
        }

        switch (status.state) {
          case NetbirdState.CONNECTED:
            this.checked = true;
            this.subtitle = "Connected";
            this.gicon = getIconFromFile(
              this._extension.metadata,
              "network-shield-symbolic",
            );
            this.menu.setHeader(this.gicon, "NetBird");
            // Update menu item with DNS name or IP
            if (this._connectionItem) {
              const connectionLabel = status.fqdn || status.ip || "Connected";
              this._connectionItem.label.text = connectionLabel;
            }
            break;
          case NetbirdState.DISCONNECTED:
            this.checked = false;
            this.subtitle = null;
            this.gicon = getIconFromFile(
              this._extension.metadata,
              "network-shield-crossed-symbolic",
            );
            this.menu.setHeader(this.gicon, "NetBird");
            if (this._connectionItem) {
              this._connectionItem.label.text = "Not Connected";
            }
            break;
          case NetbirdState.NEEDS_LOGIN:
            this.checked = false;
            this.subtitle = "Login Required";
            this.gicon = getIconFromFile(
              this._extension.metadata,
              "network-shield-question-mark-symbolic",
            );
            this.menu.setHeader(this.gicon, "NetBird");
            if (this._connectionItem) {
              this._connectionItem.label.text = "Login Required";
            }
            break;
          case NetbirdState.ERROR:
            this.checked = false;
            this.subtitle = "Error";
            this.gicon = getIconFromFile(
              this._extension.metadata,
              "network-vpn-error-symbolic",
            );
            this.menu.setHeader(this.gicon, "NetBird");
            if (this._connectionItem) {
              this._connectionItem.label.text = "Error";
            }
            break;
          default:
            this.checked = false;
            this.subtitle = "Unknown";
            this.gicon = getIconFromFile(
              this._extension.metadata,
              "network-shield-question-mark-symbolic",
            );
            this.menu.setHeader(this.gicon, "NetBird");
            if (this._connectionItem) {
              this._connectionItem.label.text = "Unknown";
            }
        }

        // Unblock signals
        if (this._clickHandlerId !== null) {
          this.unblock_signal_handler(this._clickHandlerId);
        }
      } catch (e) {
        // Block signals while updating UI
        if (this._clickHandlerId !== null) {
          this.block_signal_handler(this._clickHandlerId);
        }

        this.checked = false;
        this.subtitle = "Error";
        this.gicon = getIconFromFile(
          this._extension.metadata,
          "network-error-symbolic",
        );
        this.menu.setHeader(this.gicon, "NetBird");
        if (this._connectionItem) {
          this._connectionItem.label.text = "Error";
        }

        // Unblock signals
        if (this._clickHandlerId !== null) {
          this.unblock_signal_handler(this._clickHandlerId);
        }

        console.error("NetBird status check failed:", e);
      }
    }

    startPeriodicUpdates(): void {
      // Update status every hour
      this._updateTimeout = GLib.timeout_add_seconds(
        GLib.PRIORITY_DEFAULT,
        3600,
        () => {
          void this._updateStatus();
          return GLib.SOURCE_CONTINUE;
        },
      ) as unknown as number;

      // Refresh networks list whenever the submenu is opened
      if (this._networksSubMenu) {
        this._networksSubMenu.menu.connect(
          "open-state-changed",
          (_menu, open) => {
            if (open) {
              void this._updateNetworks();
            }
            return undefined;
          },
        );
      }
    }

    stopPeriodicUpdates(): void {
      if (this._updateTimeout !== null) {
        GLib.Source.remove(this._updateTimeout);
        this._updateTimeout = null;
      }
    }

    override destroy(): void {
      this.stopPeriodicUpdates();
      this._cleanupNotificationFilter();
      if (this._clickHandlerId !== null) {
        this.disconnect(this._clickHandlerId);
        this._clickHandlerId = null;
      }
      super.destroy();
    }
  },
);

export default class NetbirdExtension extends Extension {
  private _settings!: Gio.Settings;
  private _notificationManager: NotificationManager | null = null;
  private _client: NetbirdClient | null = null;
  private _indicator: typeof NetbirdMenuToggle.prototype | null = null;

  override enable(): void {
    this._settings = this.getSettings();
    this._notificationManager = new NotificationManager(this.metadata);
    this._client = new NetbirdClient();

    // Create and add the toggle to Quick Settings
    this._indicator = new NetbirdMenuToggle(
      this._client,
      this._settings,
      this._notificationManager,
      this,
    );

    // Initialize the indicator (checks initial state)
    void this._indicator.initialize();

    // Add to Quick Settings menu - we need to add it to the menu properly
    const quickSettingsMenu = Main.panel.statusArea.quickSettings;
    quickSettingsMenu.menu.addItem(this._indicator);

    // Start periodic status updates
    this._indicator.startPeriodicUpdates();
  }

  override disable(): void {
    // Stop periodic updates
    this._indicator?.stopPeriodicUpdates();

    // Remove and destroy the indicator
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }

    // Clean up client
    if (this._client) {
      this._client.destroy();
      this._client = null;
    }

    this._notificationManager = null;
  }
}
