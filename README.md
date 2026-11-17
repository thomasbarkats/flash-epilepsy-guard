# Flash & Epilepsy Guard

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/thomasbarkats/flash-epilepsy-guard)
[![Version](https://img.shields.io/badge/Version-0.1.0-blue)](https://github.com/thomasbarkats/flash-epilepsy-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Chrome (Chromium browsers) extension that detects intense light flashes in videos and animated images (GIF, APNG, WebP). It automatically covers potentially dangerous content with a warning while flashing is detected, helping reduce exposure for photosensitive users.

## ✨ Features

- **Flash Detection**: Analyses visible videos and animated images in real time, including YouTube animated-WebP previews
- **Preventive Overlay**: Covers flashing content with a warning and a *Show anyway* button
- **WCAG-informed**: Based on WCAG 2.3.1 luminance, frequency, and saturated-red criteria
- **Sensitivity Levels**: Low / medium / high presets to balance detection and false positives
- **Privacy-Focused**: Runs entirely client-side with no data collection

## 🪄 Usage

After installation:
1. Browse normally — protection is enabled by default
2. Potentially dangerous flashing triggers a warning over the affected content
3. The warning disappears automatically when flashing stops
4. Click *Show anyway* to bypass protection for that element
5. Use the toolbar icon to enable or disable protection

## 🔬 How it works

The extension analyses visible videos and supported animated images using a small canvas grid (20×20 by default).

Each frame is sampled to calculate luminance and colour changes. A sliding 1-second window tracks flashes in each cell, while a spatial criterion checks whether enough cells change simultaneously. Detection is based on luminance transitions and saturated-red changes, with thresholds adjusted according to the selected sensitivity level.

When a potential hazard is detected, a warning overlay covers the affected element. A short delay before removing it prevents the overlay from flickering.

Detection thresholds are configurable in [`src/config/constants.ts`](src/config/constants.ts).

## Installation

Not yet published to the Chrome Web Store. Build the extension locally (see below) and load the `package/` directory as an unpacked extension.

## Local Development

Built with TypeScript, Webpack, and the Chrome Extension API.

### Prerequisites

- Node.js (v14 or higher)
- pnpm 11 (Corepack recommended)
- Chromium-based browser

### Setup

1. Clone the repository
```bash
git clone https://github.com/thomasbarkats/flash-epilepsy-guard.git
cd flash-epilepsy-guard
```

2. Install dependencies
```bash
pnpm install --frozen-lockfile
```

3. Build the project
```bash
pnpm run build
```

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `package/` directory

5. Start development with hot-reload
```bash
pnpm run watch
```

## Limitations

- **Protected media**: Cross-origin or DRM-protected content may prevent canvas access. Such elements are skipped. Most YouTube playback is supported, but some protected streams are not.
- **Detection accuracy**: Detection is heuristic, not a medical device. It aims to reduce exposure but cannot guarantee protection. It is not a certified Harding Flash Pattern Analysis test.
- **Sampling rate**: Analysis runs at approximately 60 Hz, so flashing above 30 Hz may be missed.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
