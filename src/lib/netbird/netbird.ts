import Gio from "gi://Gio";

export enum NetbirdState {
  CONNECTED,
  DISCONNECTED,
  NEEDS_LOGIN,
  LOADING,
  ERROR,
}

export interface NetbirdStatus {
  state: NetbirdState;
  management: string;
  signal: string;
  ip: string;
  fqdn: string;
  errorMessage?: string;
}

export interface NetbirdNetwork {
  id: string;
  domains?: string | undefined;
  network?: string | undefined;
  selected: boolean;
  resolvedIPs?: string | undefined;
}

/**
 * General options that apply to all netbird commands
 */
export interface NetbirdGeneralOptions {
  managementUrl?: string | undefined;
  adminUrl?: string | undefined;
  anonymize?: boolean | undefined;
  daemonAddr?: string | undefined;
  hostname?: string | undefined;
  logFile?: string | undefined;
  logLevel?: string | undefined;
  presharedKey?: string | undefined;
  service?: string | undefined;
  setupKey?: string | undefined;
  setupKeyFile?: string | undefined;
}

/**
 * Options specific to the 'netbird up' command
 */
export interface NetbirdUpOptions {
  allowServerSsh?: boolean | undefined;
  blockInbound?: boolean | undefined;
  blockLanAccess?: boolean | undefined;
  disableAutoConnect?: boolean | undefined;
  disableClientRoutes?: boolean | undefined;
  disableDns?: boolean | undefined;
  disableFirewall?: boolean | undefined;
  disableServerRoutes?: boolean | undefined;
  dnsResolverAddress?: string | undefined;
  dnsRouterInterval?: string | undefined;
  enableLazyConnection?: boolean | undefined;
  enableRosenpass?: boolean | undefined;
  externalIpMap?: string | undefined;
  extraDnsLabels?: string | undefined;
  extraIfaceBlacklist?: string | undefined;
  interfaceName?: string | undefined;
  mtu?: number | undefined;
  networkMonitor?: boolean | undefined;
  noBrowser?: boolean | undefined;
  profile?: string | undefined;
  rosenpassPermissive?: boolean | undefined;
  wireguardPort?: number | undefined;
}

/**
 * Combined options for connection (general + up command options)
 */
export interface NetbirdConnectionOptions
  extends NetbirdGeneralOptions, NetbirdUpOptions {}

export class NetbirdClient {
  private _cancellable: Gio.Cancellable | null = null;

  /**
   * Parse the output of 'netbird status' command
   */
  private _parseStatus(output: string): NetbirdStatus {
    const lines = output.split("\n");
    const status: NetbirdStatus = {
      state: NetbirdState.DISCONNECTED,
      management: "",
      signal: "",
      ip: "",
      fqdn: "",
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("Daemon status:")) {
        const parts = trimmed.split(":");
        const daemonStatus = parts[1]?.trim();
        if (daemonStatus === "NeedsLogin") {
          status.state = NetbirdState.NEEDS_LOGIN;
        }
      } else if (trimmed.startsWith("Management:")) {
        const parts = trimmed.split(":");
        status.management = parts[1]?.trim() ?? "";
        if (status.management === "Connected") {
          status.state = NetbirdState.CONNECTED;
        }
      } else if (trimmed.startsWith("Signal:")) {
        const parts = trimmed.split(":");
        status.signal = parts[1]?.trim() ?? "";
      } else if (trimmed.startsWith("NetBird IP:")) {
        const parts = trimmed.split(":");
        status.ip = parts[1]?.trim() ?? "";
      } else if (trimmed.startsWith("FQDN:")) {
        const parts = trimmed.split(":");
        status.fqdn = parts[1]?.trim() ?? "";
      }
    }

    return status;
  }

  /**
   * Execute a command asynchronously
   */
  private async _executeCommand(
    command: string[],
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        this._cancellable = new Gio.Cancellable();
        const proc = Gio.Subprocess.new(
          command,
          Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        );

        proc.communicate_utf8_async(null, this._cancellable, (_proc, res) => {
          try {
            const [, stdout, stderr] = proc.communicate_utf8_finish(res);

            const success = proc.get_successful();
            const result: { success: boolean; output: string; error?: string } =
              {
                success,
                output: stdout || "",
              };

            if (stderr) {
              result.error = stderr;
            }

            resolve(result);
          } catch (e) {
            resolve({
              success: false,
              output: "",
              error: e instanceof Error ? e.message : String(e),
            });
          }
        });
      } catch (e) {
        resolve({
          success: false,
          output: "",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });
  }

  /**
   * Build command with global flags
   */
  private _addGlobalFlags(
    command: string[],
    options: NetbirdGeneralOptions,
  ): void {
    if (options.managementUrl) {
      command.push("--management-url", options.managementUrl);
    }
    if (options.adminUrl) {
      command.push("--admin-url", options.adminUrl);
    }
    if (options.anonymize) {
      command.push("--anonymize");
    }
    if (options.daemonAddr) {
      command.push("--daemon-addr", options.daemonAddr);
    }
    if (options.hostname) {
      command.push("--hostname", options.hostname);
    }
    if (options.logFile) {
      command.push("--log-file", options.logFile);
    }
    if (options.logLevel) {
      command.push("--log-level", options.logLevel);
    }
    if (options.presharedKey) {
      command.push("--preshared-key", options.presharedKey);
    }
    if (options.service) {
      command.push("--service", options.service);
    }
    if (options.setupKey) {
      command.push("--setup-key", options.setupKey);
    }
    if (options.setupKeyFile) {
      command.push("--setup-key-file", options.setupKeyFile);
    }
  }

  /**
   * Add connection-related flags to command
   */
  private _addConnectionFlags(
    command: string[],
    options: NetbirdUpOptions,
  ): void {
    if (options.allowServerSsh) {
      command.push("--allow-server-ssh");
    }
    if (options.blockInbound) {
      command.push("--block-inbound");
    }
    if (options.blockLanAccess) {
      command.push("--block-lan-access");
    }
    if (options.disableAutoConnect) {
      command.push("--disable-auto-connect");
    }
  }

  /**
   * Add route-related flags to command
   */
  private _addRouteFlags(command: string[], options: NetbirdUpOptions): void {
    if (options.disableClientRoutes) {
      command.push("--disable-client-routes");
    }
    if (options.disableServerRoutes) {
      command.push("--disable-server-routes");
    }
  }

  /**
   * Add DNS-related flags to command
   */
  private _addDnsFlags(command: string[], options: NetbirdUpOptions): void {
    if (options.disableDns) {
      command.push("--disable-dns");
    }
    if (options.dnsResolverAddress) {
      command.push("--dns-resolver-address", options.dnsResolverAddress);
    }
    if (options.dnsRouterInterval) {
      command.push("--dns-router-interval", options.dnsRouterInterval);
    }
    if (options.extraDnsLabels) {
      command.push("--extra-dns-labels", options.extraDnsLabels);
    }
  }

  /**
   * Add network-related flags to command
   */
  private _addNetworkFlags(command: string[], options: NetbirdUpOptions): void {
    if (options.disableFirewall) {
      command.push("--disable-firewall");
    }
    if (options.interfaceName) {
      command.push("--interface-name", options.interfaceName);
    }
    if (options.mtu) {
      command.push("--mtu", options.mtu.toString());
    }
    if (options.wireguardPort) {
      command.push("--wireguard-port", options.wireguardPort.toString());
    }
    if (options.externalIpMap) {
      command.push("--external-ip-map", options.externalIpMap);
    }
    if (options.extraIfaceBlacklist) {
      command.push("--extra-iface-blacklist", options.extraIfaceBlacklist);
    }
    if (options.networkMonitor !== undefined) {
      command.push(
        "--network-monitor=" + (options.networkMonitor ? "true" : "false"),
      );
    }
  }

  /**
   * Add experimental and auth flags to command
   */
  private _addExperimentalAndAuthFlags(
    command: string[],
    options: NetbirdUpOptions,
  ): void {
    if (options.enableLazyConnection) {
      command.push("--enable-lazy-connection");
    }
    if (options.enableRosenpass) {
      command.push("--enable-rosenpass");
    }
    if (options.rosenpassPermissive) {
      command.push("--rosenpass-permissive");
    }
    if (options.noBrowser) {
      command.push("--no-browser");
    }
    if (options.profile) {
      command.push("--profile", options.profile);
    }
  }

  /**
   * Build up command with all flags
   */
  private _buildUpCommand(options: NetbirdConnectionOptions): string[] {
    const command = ["netbird"];

    // Add global flags before the subcommand
    this._addGlobalFlags(command, options);

    // Add the up subcommand
    command.push("up");

    // Add up-specific flags organized by category
    this._addConnectionFlags(command, options);
    this._addRouteFlags(command, options);
    this._addDnsFlags(command, options);
    this._addNetworkFlags(command, options);
    this._addExperimentalAndAuthFlags(command, options);

    return command;
  }

  /**
   * Build down command with global flags
   */
  private _buildDownCommand(options: NetbirdGeneralOptions): string[] {
    const command = ["netbird"];

    // Add global flags before the subcommand
    this._addGlobalFlags(command, options);

    // Add the down subcommand
    command.push("down");

    return command;
  }

  /**
   * Build status command with global flags
   */
  private _buildStatusCommand(options: NetbirdGeneralOptions): string[] {
    const command = ["netbird"];

    // Add global flags before the subcommand
    this._addGlobalFlags(command, options);

    // Add the status subcommand
    command.push("status");

    return command;
  }

  /**
   * Get the current status of NetBird
   */
  async getStatus(options: NetbirdGeneralOptions = {}): Promise<NetbirdStatus> {
    const command = this._buildStatusCommand(options);
    console.log(`[NetBird] Executing status check: ${command.join(" ")}`);
    const result = await this._executeCommand(command);

    if (!result.success) {
      console.log(
        `[NetBird] Status check failed: ${result.error ?? "Unknown error"}`,
      );
      return {
        state: NetbirdState.ERROR,
        management: "",
        signal: "",
        ip: "",
        fqdn: "",
        errorMessage: result.error ?? "Failed to get status",
      };
    }

    console.log(`[NetBird] Status check successful`);
    return this._parseStatus(result.output);
  }

  /**
   * Connect to NetBird with options
   */
  async connect(
    options: NetbirdConnectionOptions = {},
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const command = this._buildUpCommand(options);
    console.log(`[NetBird] Executing connect command: ${command.join(" ")}`);
    const result = await this._executeCommand(command);
    if (result.success) {
      console.log(`[NetBird] Connect command completed successfully`);
    } else {
      console.log(
        `[NetBird] Connect command failed: ${result.error ?? "Unknown error"}`,
      );
    }
    return result;
  }

  /**
   * Disconnect from NetBird with options
   */
  async disconnect(
    options: NetbirdGeneralOptions = {},
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const command = this._buildDownCommand(options);
    console.log(`[NetBird] Executing disconnect command: ${command.join(" ")}`);
    const result = await this._executeCommand(command);
    if (result.success) {
      console.log(`[NetBird] Disconnect command completed successfully`);
    } else {
      console.log(
        `[NetBird] Disconnect command failed: ${result.error ?? "Unknown error"}`,
      );
    }
    return result;
  }

  /**
   * Parse the output of 'netbird networks list' command
   */
  private _parseNetworksList(output: string): NetbirdNetwork[] {
    const networks: NetbirdNetwork[] = [];
    // Split on blank lines (only horizontal whitespace between newlines)
    const blocks = output.split(/\n[ \t]*\n/);

    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.replace(/^\s+/, ""));

      // Skip header blocks like "Available Networks:"
      if (lines.every((l) => !l.startsWith("- ID:") && !l.startsWith("ID:"))) {
        continue;
      }
      let id: string | undefined;
      let domains: string | undefined;
      let network: string | undefined;
      let selected = false;
      let resolvedIPs: string | undefined;

      for (const line of lines) {
        if (line.startsWith("- ID:")) {
          id = line.replace(/^-\s*ID:\s*/, "");
        } else if (line.startsWith("ID:")) {
          id = line.replace(/^ID:\s*/, "");
        } else if (line.startsWith("Domains:")) {
          domains = line.replace(/^Domains:\s*/, "").trim();
        } else if (line.startsWith("Network:")) {
          network = line.replace(/^Network:\s*/, "").trim();
        } else if (line.startsWith("Status:")) {
          const status = line.replace(/^Status:\s*/, "").trim();
          selected = status === "Selected";
        } else if (line.startsWith("Resolved IPs:")) {
          const val = line.replace(/^Resolved IPs:\s*/, "").trim();
          if (val !== "-") {
            resolvedIPs = val;
          }
        }
      }

      if (id) {
        networks.push({ id, domains, network, selected, resolvedIPs });
      }
    }

    return networks;
  }

  /**
   * Build networks list command with global flags
   */
  private _buildNetworksListCommand(options: NetbirdGeneralOptions): string[] {
    const command = ["netbird"];
    this._addGlobalFlags(command, options);
    command.push("networks", "list");
    return command;
  }

  /**
   * Build networks select/deselect command with global flags
   */
  private _buildNetworksToggleCommand(
    options: NetbirdGeneralOptions,
    action: "select" | "deselect",
    networkId: string,
  ): string[] {
    const command = ["netbird"];
    this._addGlobalFlags(command, options);
    command.push("networks", action);
    if (action === "select") {
      // otherwise the command will replace the current selection instead of adding to it
      command.push("--append");
    }
    command.push(networkId);
    return command;
  }

  /**
   * List available networks
   */
  async listNetworks(
    options: NetbirdGeneralOptions = {},
  ): Promise<{ success: boolean; networks: NetbirdNetwork[]; error?: string }> {
    const command = this._buildNetworksListCommand(options);
    console.log(`[NetBird] Executing networks list: ${command.join(" ")}`);
    const result = await this._executeCommand(command);

    if (!result.success) {
      console.log(
        `[NetBird] Networks list failed: ${result.error ?? "Unknown error"}`,
      );
      return {
        success: false,
        networks: [],
        error: result.error ?? "Failed to list networks",
      };
    }

    const networks = this._parseNetworksList(result.output);
    console.log(`[NetBird] Found ${networks.length.toString()} networks`);
    return { success: true, networks };
  }

  /**
   * Select a network by ID
   */
  async selectNetwork(
    networkId: string,
    options: NetbirdGeneralOptions = {},
  ): Promise<{ success: boolean; error?: string | undefined }> {
    const command = this._buildNetworksToggleCommand(
      options,
      "select",
      networkId,
    );
    console.log(`[NetBird] Selecting network: ${command.join(" ")}`);
    const result = await this._executeCommand(command);
    if (!result.success) {
      console.log(
        `[NetBird] Network select failed: ${result.error ?? "Unknown error"}`,
      );
    }
    return { success: result.success, error: result.error };
  }

  /**
   * Deselect a network by ID
   */
  async deselectNetwork(
    networkId: string,
    options: NetbirdGeneralOptions = {},
  ): Promise<{ success: boolean; error?: string | undefined }> {
    const command = this._buildNetworksToggleCommand(
      options,
      "deselect",
      networkId,
    );
    console.log(`[NetBird] Deselecting network: ${command.join(" ")}`);
    const result = await this._executeCommand(command);
    if (!result.success) {
      console.log(
        `[NetBird] Network deselect failed: ${result.error ?? "Unknown error"}`,
      );
    }
    return { success: result.success, error: result.error };
  }

  /**
   * Cancel any ongoing operations
   */
  cancel(): void {
    if (this._cancellable) {
      this._cancellable.cancel();
      this._cancellable = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancel();
  }
}
