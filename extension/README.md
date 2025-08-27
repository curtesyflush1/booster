# BoosterBeacon Browser Extension

A browser extension that provides automated checkout assistance and product detection for Pokémon TCG collectors on major retailer websites.

## Features

- **Product Detection**: Automatically detects Pokémon TCG products on supported retailer sites
- **Quick Actions**: Floating action button for easy access to BoosterBeacon features
- **Auto-fill Checkout**: Automatically fills shipping and payment information during checkout
- **Real-time Sync**: Syncs with your BoosterBeacon account for personalized alerts
- **Multi-retailer Support**: Works on Best Buy, Walmart, Costco, and Sam's Club

## Supported Retailers

- **Best Buy** - Full API integration with cart links
- **Walmart** - Affiliate feed integration
- **Costco** - Polite monitoring (no cart integration)
- **Sam's Club** - Polite monitoring (no cart integration)

## Installation

### Development Installation

1. Clone the repository and navigate to the extension directory:
   ```bash
   cd extension
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build:chrome  # For Chrome
   npm run build:firefox # For Firefox
   ```

3. Load the extension in your browser:
   
   **Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder
   
   **Firefox:**
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on" and select the `manifest.json` in the `dist` folder

### Production Installation

The extension will be available on the Chrome Web Store and Firefox Add-ons store once released.

## Development

### Project Structure

```
extension/
├── src/
│   ├── background/     # Background service worker
│   ├── content/        # Content scripts for retailer sites
│   ├── popup/          # Extension popup UI
│   ├── options/        # Settings page
│   └── shared/         # Shared utilities and types
├── manifest/           # Browser-specific manifests
├── icons/              # Extension icons
└── tests/              # Test files
```

### Available Scripts

- `npm run dev` - Start development build with watch mode
- `npm run build` - Build for production
- `npm run build:chrome` - Build specifically for Chrome
- `npm run build:firefox` - Build specifically for Firefox
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run package:chrome` - Create Chrome extension package
- `npm run package:firefox` - Create Firefox extension package

### Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:coverage
```

### Code Style

The project uses ESLint and TypeScript for code quality. Run linting:

```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

## Architecture

### Background Script

The background script (`src/background/background.ts`) handles:
- Message passing between extension components
- Data synchronization with BoosterBeacon API
- Periodic tasks and alarms
- Extension lifecycle management

### Content Scripts

Content scripts (`src/content/content.ts`) are injected into retailer websites and provide:
- Product detection and information extraction
- UI injection for BoosterBeacon features
- Checkout form automation
- Page monitoring and analytics

### Popup UI

The popup (`src/popup/`) provides a quick interface for:
- Viewing account status and recent alerts
- Managing extension settings
- Quick actions and navigation

### Options Page

The options page (`src/options/`) offers detailed settings for:
- Extension configuration
- Retailer-specific settings
- Account management
- Data import/export

## Security & Privacy

- **Secure Storage**: User credentials are encrypted using enterprise-grade encryption
- **Minimal Permissions**: Extension only requests necessary permissions
- **No Data Collection**: Extension does not collect or transmit personal data without consent
- **Compliance**: Respects retailer terms of service and rate limits

## Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3)
- **Firefox**: Version 109+ (Manifest V2)
- **Edge**: Chromium-based versions (same as Chrome)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see the main project LICENSE file for details.

## Support

For support and bug reports, please visit:
- [BoosterBeacon Help Center](https://boosterbeacon.com/help)
- [GitHub Issues](https://github.com/curtesyflush1/booster/issues)

## Changelog

### Version 1.0.0
- Initial release
- Basic product detection
- Multi-retailer support
- Auto-fill functionality
- Settings management