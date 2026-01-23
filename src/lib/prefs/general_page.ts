import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { getTemplate } from "./template.js";
import { SettingsKeys } from "../settings/settings.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
interface NetbirdGeneralPage {
  // Global Settings
  _managementUrl: Adw.EntryRow;
  _adminUrl: Adw.EntryRow;
  _anonymize: Adw.SwitchRow;
  _daemonAddr: Adw.EntryRow;
  _hostname: Adw.EntryRow;
  _logFile: Adw.EntryRow;
  _logLevel: Adw.ComboRow;
  _presharedKey: Adw.PasswordEntryRow;
  _service: Adw.EntryRow;
  _setupKey: Adw.PasswordEntryRow;
  _setupKeyFile: Adw.EntryRow;

  // Connection Settings
  _allowServerSsh: Adw.SwitchRow;
  _blockInbound: Adw.SwitchRow;
  _blockLanAccess: Adw.SwitchRow;
  _disableAutoConnect: Adw.SwitchRow;

  // Route Settings
  _disableClientRoutes: Adw.SwitchRow;
  _disableServerRoutes: Adw.SwitchRow;

  // DNS Settings
  _disableDns: Adw.SwitchRow;
  _dnsResolverAddress: Adw.EntryRow;
  _dnsRouterInterval: Adw.EntryRow;
  _extraDnsLabels: Adw.EntryRow;

  // Firewall Settings
  _disableFirewall: Adw.SwitchRow;

  // Advanced Network Settings
  _interfaceName: Adw.EntryRow;
  _mtu: Adw.SpinRow;
  _wireguardPort: Adw.SpinRow;
  _externalIpMap: Adw.EntryRow;
  _extraIfaceBlacklist: Adw.EntryRow;
  _networkMonitor: Adw.SwitchRow;

  // Experimental Features
  _enableLazyConnection: Adw.SwitchRow;
  _enableRosenpass: Adw.SwitchRow;
  _rosenpassPermissive: Adw.SwitchRow;

  // Authentication Settings
  _noBrowser: Adw.SwitchRow;
  _profile: Adw.EntryRow;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class NetbirdGeneralPage extends Adw.PreferencesPage {
  constructor(settings: Gio.Settings) {
    super();

    // Global Settings
    settings.bind(
      SettingsKeys.General.ManagementUrl,
      this._managementUrl,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.AdminUrl,
      this._adminUrl,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.Anonymize,
      this._anonymize,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.DaemonAddr,
      this._daemonAddr,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.Hostname,
      this._hostname,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.LogFile,
      this._logFile,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Log level ComboRow binding
    const logLevels = ["trace", "debug", "info", "warn", "error"];
    const currentLogLevel = settings.get_string(SettingsKeys.General.LogLevel);
    this._logLevel.set_selected(logLevels.indexOf(currentLogLevel));
    this._logLevel.connect("notify::selected", () => {
      const selected = logLevels[this._logLevel.get_selected()];
      if (selected) {
        settings.set_string(SettingsKeys.General.LogLevel, selected);
      }
    });

    settings.bind(
      SettingsKeys.General.PresharedKey,
      this._presharedKey,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.Service,
      this._service,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.SetupKey,
      this._setupKey,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.General.SetupKeyFile,
      this._setupKeyFile,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Connection Settings
    settings.bind(
      SettingsKeys.Up.AllowServerSsh,
      this._allowServerSsh,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.BlockInbound,
      this._blockInbound,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.BlockLanAccess,
      this._blockLanAccess,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.DisableAutoConnect,
      this._disableAutoConnect,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Route Settings
    settings.bind(
      SettingsKeys.Up.DisableClientRoutes,
      this._disableClientRoutes,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.DisableServerRoutes,
      this._disableServerRoutes,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // DNS Settings
    settings.bind(
      SettingsKeys.Up.DisableDns,
      this._disableDns,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.DnsResolverAddress,
      this._dnsResolverAddress,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.DnsRouterInterval,
      this._dnsRouterInterval,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.ExtraDnsLabels,
      this._extraDnsLabels,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Firewall Settings
    settings.bind(
      SettingsKeys.Up.DisableFirewall,
      this._disableFirewall,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Advanced Network Settings
    settings.bind(
      SettingsKeys.Up.InterfaceName,
      this._interfaceName,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.Mtu,
      this._mtu,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.WireguardPort,
      this._wireguardPort,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.ExternalIpMap,
      this._externalIpMap,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.ExtraIfaceBlacklist,
      this._extraIfaceBlacklist,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.NetworkMonitor,
      this._networkMonitor,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Experimental Features
    settings.bind(
      SettingsKeys.Up.EnableLazyConnection,
      this._enableLazyConnection,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.EnableRosenpass,
      this._enableRosenpass,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.RosenpassPermissive,
      this._rosenpassPermissive,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    // Authentication Settings
    settings.bind(
      SettingsKeys.Up.NoBrowser,
      this._noBrowser,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    settings.bind(
      SettingsKeys.Up.Profile,
      this._profile,
      "text",
      Gio.SettingsBindFlags.DEFAULT,
    );
  }
}

export default GObject.registerClass(
  {
    GTypeName: "NetbirdGeneralPage",
    Template: getTemplate("GeneralPage"),
    InternalChildren: [
      "managementUrl",
      "adminUrl",
      "anonymize",
      "daemonAddr",
      "hostname",
      "logFile",
      "logLevel",
      "presharedKey",
      "service",
      "setupKey",
      "setupKeyFile",
      "allowServerSsh",
      "blockInbound",
      "blockLanAccess",
      "disableAutoConnect",
      "disableClientRoutes",
      "disableServerRoutes",
      "disableDns",
      "dnsResolverAddress",
      "dnsRouterInterval",
      "extraDnsLabels",
      "disableFirewall",
      "interfaceName",
      "mtu",
      "wireguardPort",
      "externalIpMap",
      "extraIfaceBlacklist",
      "networkMonitor",
      "enableLazyConnection",
      "enableRosenpass",
      "rosenpassPermissive",
      "noBrowser",
      "profile",
    ],
  },
  NetbirdGeneralPage,
);
