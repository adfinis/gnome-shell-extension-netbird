/**
 * Helper function to create a settings key with a category prefix
 * @param category - The category prefix (e.g., "general", "up", "down")
 * @param key - The actual setting key
 * @returns The prefixed settings key (e.g., "general-management-url")
 */
function createKey(category: string, key: string): string {
  return `${category}-${key}`;
}

/**
 * Helper function to create a category object with automatic category prefixing
 * @param category - The category name to use as prefix
 * @param keys - Object mapping property names to setting key names
 * @returns An object with getters that automatically prefix keys with the category
 */
function createCategory<T extends Record<string, string>>(
  category: string,
  keys: T,
) {
  const result: Record<string, unknown> = {};
  for (const [prop, key] of Object.entries(keys)) {
    Object.defineProperty(result, prop, {
      get() {
        return createKey(category, key);
      },
      enumerable: true,
    });
  }
  return result as { readonly [K in keyof T]: string };
}

/**
 * Settings keys organized by category with automatic prefixing.
 * Access keys like: SettingsKeys.General.ManagementUrl
 * This returns "general-management-url" for use with GSettings.
 */
export const SettingsKeys = {
  /**
   * General/Global settings that apply across all commands
   */
  General: createCategory("general", {
    ManagementUrl: "management-url",
    AdminUrl: "admin-url",
    Anonymize: "anonymize",
    DaemonAddr: "daemon-addr",
    Hostname: "hostname",
    LogFile: "log-file",
    LogLevel: "log-level",
    PresharedKey: "preshared-key",
    Service: "service",
    SetupKey: "setup-key",
    SetupKeyFile: "setup-key-file",
  }),

  /**
   * Settings specific to the 'up' command
   */
  Up: createCategory("up", {
    // Connection Settings
    AllowServerSsh: "allow-server-ssh",
    BlockInbound: "block-inbound",
    BlockLanAccess: "block-lan-access",
    DisableAutoConnect: "disable-auto-connect",

    // Route Settings
    DisableClientRoutes: "disable-client-routes",
    DisableServerRoutes: "disable-server-routes",

    // DNS Settings
    DisableDns: "disable-dns",
    DnsResolverAddress: "dns-resolver-address",
    DnsRouterInterval: "dns-router-interval",
    ExtraDnsLabels: "extra-dns-labels",

    // Firewall Settings
    DisableFirewall: "disable-firewall",

    // Advanced Network Settings
    InterfaceName: "interface-name",
    Mtu: "mtu",
    WireguardPort: "wireguard-port",
    ExternalIpMap: "external-ip-map",
    ExtraIfaceBlacklist: "extra-iface-blacklist",
    NetworkMonitor: "network-monitor",

    // Experimental Features
    EnableLazyConnection: "enable-lazy-connection",
    EnableRosenpass: "enable-rosenpass",
    RosenpassPermissive: "rosenpass-permissive",

    // Authentication Settings
    NoBrowser: "no-browser",
    Profile: "profile",
  }),
} as const;
