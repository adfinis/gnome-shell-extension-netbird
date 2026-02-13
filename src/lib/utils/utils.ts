import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import { type Extension } from "resource:///org/gnome/shell/extensions/extension.js";

type ExtensionMetadata = Extension["metadata"];

export function findChildByType<T>(
  parent: Gtk.Widget | null,
  type: new (...args: never[]) => T,
): T | null {
  if (!parent) return null;
  for (const child of parent) {
    if (child instanceof type) return child;
    const match = findChildByType(child, type);
    if (match) return match;
  }
  return null;
}

export function getIconFromFile(
  metadata: ExtensionMetadata,
  iconName: string,
): Gio.Icon {
  const iconFile = Gio.File.new_for_path(
    `${metadata["path"]}/icons/${iconName}.svg`, // eslint-disable-line @typescript-eslint/dot-notation
  );
  return new Gio.FileIcon({ file: iconFile });
}
