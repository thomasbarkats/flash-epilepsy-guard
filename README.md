# Epilep'rev

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://github.com/thomasbarkats/epileprev)
[![Version](https://img.shields.io/badge/Version-0.1.0-blue)](https://github.com/thomasbarkats/epileprev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Chrome (Chromium browsers) extension that watches the screen for intense light flashes — typically in `<video>` players (YouTube and others) or animated `<img>` GIFs — and covers the offending area with a preventive warning while the flashing lasts, removing it once the content is safe again. Built to reduce exposure for photosensitive users.

It runs entirely in the background with no popup window: clicking the toolbar icon toggles protection on/off (the badge shows `ON`/`OFF`).

## 📋 Features

- **Flash Detection**: Analyses visible `<video>` and animated GIF regions in real time
- **Preventive Overlay**: Covers only the flashing element, with a *Show anyway* button
- **Standards-Based**: Thresholds follow WCAG 2.3.1 and the Harding flash analysis, including saturated-red flashing
- **Sensitivity Levels**: Low / medium / high presets to trade false positives for protection
- **Privacy-Focused**: Works entirely client-side with no data collection

## 🧪 Usage

After installation:
1. Browse normally — protection is enabled by default on every page
2. When dangerous flashing is detected, the affected video/GIF is covered by a warning
3. The overlay disappears automatically once the flashing stops
4. Click *Show anyway* on the overlay to reveal that element regardless
5. Click the toolbar icon to disable/enable protection (the badge shows `ON`/`OFF`)

## 🔬 How it works

For every visible, sufficiently large `<video>` / `<img>` element:

1. **Sampling**: the element is redrawn each animation frame onto a tiny `gridSize × gridSize` canvas (default 20×20); downscaling box-filters each region into one averaged sample per cell
2. **Per-cell luminance**: each cell's relative luminance is computed (sRGB → linear, Rec.709 weights), and saturated-red pixels are flagged separately
3. **Flash counting**: per cell, a sliding 1 s window counts luminance transitions — a change of ≥10% of max luminance with the darker frame below 0.80; ~6 transitions/s matches the WCAG "more than 3 flashes per second" limit
4. **Spatial criterion**: the area is flagged as dangerous only when ≥25% of cells are individually flashing (the Harding / WCAG area rule), which keeps small UI animations from triggering false positives
5. **Overlay**: a warning panel covers the element's bounding box, kept up via a short cooldown (hysteresis) so it does not flicker

Thresholds are tunable per sensitivity preset in [`src/config/constants.ts`](src/config/constants.ts).

## Installation

Not yet published to the Chrome Web Store. Build it locally (see below) and load the `package/` directory as an unpacked extension.

## Local Development

This project uses TypeScript, Webpack, and the Chrome Extension API.

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chromium based browser supporting extensions

### Setup

1. Clone the repository
```bash
git clone https://github.com/thomasbarkats/epileprev.git
cd epileprev
```

2. Install dependencies
```bash
npm install
```

3. Build the project
```bash
npm run build
```

4. Load the extension in Chrome
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the project `/package` directory

5. Start development with hot-reload
```bash
npm run watch
```

## Limitations

- **Cross-origin / DRM media taints the canvas**, so its pixels cannot be read; the affected element is detected and silently skipped. Most YouTube playback (MSE/blob, non-DRM) is readable, some protected streams are not.
- Detection is heuristic and **not a medical device**. It aims to reduce, not guarantee elimination of, exposure to provocative flashing.
- Analysis runs at the display refresh rate (≈60 Hz via `requestAnimationFrame`), so flashing faster than ~30 Hz may be undersampled.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
