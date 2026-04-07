# NoBridge

NoBridge is a peer-to-peer communication app built with React, Vite, WebRTC, and PeerJS. It lets two people connect directly in the browser to chat, transfer files, start audio calls, and share screens without creating accounts or running a backend chat service.

## Features

- Direct peer-to-peer text chat
- File transfer with progress indicators
- Audio calling with mute and call status UI
- Screen sharing with quality presets
- Typing indicators and session status messages
- Chrome extension manifest included for unpacked-extension usage

## How It Works

Each user gets a generated peer ID that can be shared manually. PeerJS is used for peer discovery and signaling, and the actual communication happens over WebRTC once a connection is established.

This project is designed as a lightweight one-to-one direct-sharing tool.

## Tech Stack

- React 19
- Vite 6
- Material UI
- PeerJS
- WebRTC

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Run Locally

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Production Build

```bash
npm run build
```

The production build output is generated in `dist/`.

## Load As A Chrome Extension

1. Build the project with `npm run build`.
2. Open `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `dist/` folder.

The extension uses the assets from `public/`, including `manifest.json` and `background.js`.

## Extension Permissions

The Chrome extension manifest currently requests:

- `tabs`
- `activeTab`
- `desktopCapture`

These permissions are used to open the app UI from the extension action and support screen-sharing related browser capabilities.

## Project Structure

```text
src/
  components/      UI for chat, calls, and screen sharing
  hooks/           Main app state and interaction logic
  services/        PeerJS/WebRTC wrapper
public/
  manifest.json    Chrome extension manifest
  background.js    Opens the app when the extension icon is clicked
```

## Known Limitations

- Reliability depends on WebRTC behavior, NAT, firewall rules, and browser support.
- The app currently supports one active peer session at a time.
- Screen sharing works best on desktop browsers.
- Some restricted networks may block or degrade peer-to-peer connectivity.
- Mobile browser support is more limited than desktop support.

## Browser Support

- Chrome: recommended
- Edge: generally supported
- Firefox: partial to good support depending on WebRTC behavior
- Safari: more limited, especially around screen/audio sharing

For the best experience, use a current desktop Chromium-based browser.

## Privacy Notes

- No login flow is required.
- No app-specific message database is included in this repo.
- Peer signaling is handled through PeerJS.
- Shared content is intended to flow directly between connected peers after signaling.

## Additional Notes

Helpful project docs in this repo:

- `SCREEN_SHARING_GUIDE.md`
- `FUNCTIONALITY_TEST_CHECKLIST.md`
- `COMPATIBILITY_VERIFICATION.md`

## Status

This is an early open-source release of the project. The main features are implemented, but real-world WebRTC behavior can vary by browser and network environment.

## Contributing

Issues, bug reports, and improvement suggestions are welcome. If you open an issue, include your browser, OS, and reproduction steps when possible.

See `CONTRIBUTING.md` for contribution guidance.

## License

MIT
