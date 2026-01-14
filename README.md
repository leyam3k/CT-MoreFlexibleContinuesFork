# CT-MoreFlexibleContinuesFork

A SillyTavern/CozyTavern extension that provides enhanced continue/edit history management with a visual version tracking system. This fork repositions the extension's controls into the message action bar for better integration with SillyTavern's UI.

## Features

- **Version History Tracking**: Every edit and continue operation is tracked in a tree structure, allowing you to navigate between different versions of a message.
- **Version Indicator**: A subtle `current/total` display shows how many versions exist for each message and which one is currently selected (e.g., `2/3` means you're viewing version 2 of 3 total versions).
- **Integrated Button Placement**: Action buttons are placed directly in the message action bar (alongside translate, copy, etc.) for a cleaner, more native feel.
- **Tree View Navigation**: Click the "Show continues" button to view and select from all available versions in a hierarchical tree view.
- **Undo/Redo Continues**: Quickly undo the last continue operation or regenerate from a specific point in the history.

## Installation and Usage

### Installation

1. Open SillyTavern and navigate to the Extensions panel
2. Use the "Install Extension" option
3. Enter the repository URL: `https://github.com/leyam3k/CT-MoreFlexibleContinuesFork`
4. Click Install

Alternatively, clone this repository directly into your SillyTavern's `public/scripts/extensions/third-party/` directory.

### Usage

Once installed, the extension automatically adds buttons to each message's action bar:

| Button            | Icon  | Description                                                    |
| ----------------- | ----- | -------------------------------------------------------------- |
| Undo              | ↶     | Remove the last continue (only on last message)                |
| Regenerate        | ↻     | Regenerate from the last continue point (only on last message) |
| Show Continues    | 📑    | View the version tree and select a different version           |
| Version Indicator | `1/1` | Shows current version / total versions                         |
| Continue          | →     | Continue generating from this point (only on last message)     |

**Version Indicator Explained:**

- `1/1` - Unmodified message (no edits or continues)
- `2/2` - Message has been edited once, viewing the latest version
- `2/3` - Message has 3 versions, currently viewing version 2

## Slash Commands

The extension also provides slash commands for automation:

- `/continue-undo` - Undo the last continue operation
- `/continue-regenerate` - Regenerate the last continue

## Prerequisites

- SillyTavern version 1.12.0 or higher recommended
- Works with all API backends

## Support and Contributions

For issues, feature requests, or contributions:

- Open an issue on the [GitHub repository](https://github.com/leyam3k/CT-MoreFlexibleContinuesFork)
- Pull requests are welcome!

This is a fork of the original More Flexible Continues extension, modified for Cozy Tavern with improved UI integration.

## License

AGPL-3.0 - See LICENSE file for details.
