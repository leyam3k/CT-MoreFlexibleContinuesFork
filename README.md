# CT-MoreFlexibleContinuesFork

A SillyTavern/CozyTavern extension that provides flexible continue functionality for chat messages.

## Features

- **Continue Generation**: Add a "Continue" button to generate more content for the last message
- **Undo Continue**: Remove the last continue operation and revert to previous state
- **Regenerate Continue**: Regenerate the last continued portion
- **Continue History**: View and navigate through continue branches (swipe-like functionality)
- **Integration with Message Buttons**: Buttons are placed alongside standard message action buttons

## Installation

### Installation via Extension Installer

Use SillyTavern's built-in extension installer with the repository URL.

### Manual Installation

1. Clone or download this repository
2. Place the `CT-MoreFlexibleContinuesFork` folder in `SillyTavern/public/scripts/extensions/third-party/`
3. Restart SillyTavern

## Usage

The extension adds four buttons to each message's action bar:

1. **Undo** (↶): Remove the last continue segment (only visible on the last message)
2. **Regenerate** (↻): Regenerate the last continue segment (only visible on the last message)
3. **Show Continues** (≡): View the continue history tree and switch between branches
4. **Continue** (→): Continue generating from this message

### Slash Commands

- `/continue-undo` - Undo the last continue operation
- `/continue-regenerate` - Regenerate the last continue operation

## Prerequisites

- SillyTavern (latest version recommended)

## Differences from Original

This fork modifies the button placement:
- Buttons are now placed in the message action buttons bar (`extraMesButtons`)
- Buttons appear before the translate button
- A visual separator distinguishes MFC buttons from regular message buttons
- Settings panel removed (simplified UX)

## License

MIT
