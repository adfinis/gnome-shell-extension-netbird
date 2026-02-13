import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as MessageTray from "resource:///org/gnome/shell/ui/messageTray.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import { getIconFromFile } from "../utils/utils.js";

type ExtensionMetadata = Extension["metadata"];

export class NotificationManager {
  private _source: MessageTray.Source | null = null;
  private _metadata: ExtensionMetadata;

  constructor(metadata: ExtensionMetadata) {
    this._metadata = metadata;
  }

  private initNotificationSource(): void {
    if (this._source) return;

    this._source = new MessageTray.Source({
      title: this._metadata.name,
      icon: getIconFromFile(this._metadata, "network-shield-symbolic.svg"),
    });
    this._source.connect("destroy", () => {
      this._source = null;
    });
    Main.messageTray.add(this._source);
  }

  private sendNotification(
    title: string,
    body: string,
    iconName: string,
    urgency: MessageTray.Urgency = MessageTray.Urgency.NORMAL,
    actions: { label: string; action?: () => void }[] = [],
  ): MessageTray.Notification | null {
    // make sure we have a valid notification source
    this.initNotificationSource();

    const notification = new MessageTray.Notification({
      source: this._source,
      title: _(title),
      body: _(body),
      gicon: getIconFromFile(this._metadata, iconName),
      urgency: urgency,
    });
    for (const action of actions) {
      if (action.label) {
        notification.addAction(_(action.label), () => {
          action.action?.();
        });
      }
    }
    this._source?.addNotification(notification);
    return notification;
  }

  notifyError(body: string): void {
    this.sendNotification(
      "Upps! Something went wrong",
      body,
      "error-outline-symbolic",
      MessageTray.Urgency.CRITICAL,
    );
  }

  notifyInfo(title: string, body: string): void {
    this.sendNotification(
      title,
      body,
      "network-shield-symbolic",
      MessageTray.Urgency.NORMAL,
    );
  }

  notifySuccess(title: string, body: string): void {
    this.sendNotification(
      title,
      body,
      "network-shield-symbolic",
      MessageTray.Urgency.LOW,
    );
  }

  notifyWarning(title: string, body: string): void {
    this.sendNotification(
      title,
      body,
      "warning-outline-symbolic",
      MessageTray.Urgency.HIGH,
    );
  }
}
