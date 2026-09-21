# Selenium Baseline Framework

Selenium WebDriver-based GUI automation framework for validating every screen
in the application by navigating through all menu items.

## Features

- **MenuNavigator** — Discovers and navigates all menu items, validates menu structure stability
- **ScreenValidator** — Validates screen loads, UI elements, error states, popups
- **FailureReporter** — Generates structured prompt-style issue entries
- **TestRunSummary** — Produces final summary with stability rating and recommendations
- **PromptFormatter** — Formats output as prompt-style rows for issue tracking

## Quick Start

```bash
# Run the full baseline test
npm run selenium:baseline

# With custom target URL
TARGET_BASE_URL=http://myapp:8080 npm run selenium:baseline

# With custom config via environment variables
SELENIUM_TIMEOUT_MS=30000 \
SELENIUM_BROWSER=chrome \
REPORTING_DIR=./evidence/baseline \
npm run selenium:baseline
```

## Programmatic Usage

```typescript
import { runBaseline, MenuNavigator, ScreenValidator } from '@gavriq/selenium-baseline';

// Run the full baseline
const result = await runBaseline({
  config: { baseUrl: 'http://localhost:8001' },
  menuFilter: ['Dashboard', 'Configuration'],
});

console.log(result.summary);
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `TARGET_BASE_URL` | `http://localhost:8001` | Application base URL |
| `SELENIUM_TIMEOUT_MS` | `15000` | Operation timeout in ms |
| `SELENIUM_BROWSER` | `chrome` | Browser: chrome, firefox, edge |
| `SELENIUM_HEADLESS` | `true` | Run headless |
| `REPORTING_DIR` | `./evidence/selenium-baseline` | Screenshot output directory |
| `LOCATOR_STRATEGY` | `css` | Default locator strategy |
| `MENU_CONTAINER_SELECTOR` | `.opsc-nav` | CSS selector for menu container |
| `MENU_ITEM_SELECTOR` | `.opsc-navitem` | CSS selector for menu items |
| `PAGE_HEADER_SELECTOR` | `h1, h2, [role="heading"]` | CSS selector for page headers |
| `ERROR_SELECTOR` | `.error-message, .alert-danger` | CSS selector for error elements |
| `POPUP_SELECTOR` | `.modal, .popup, .dialog` | CSS selector for popup elements |
| `NAVIGATION_DELAY_MS` | `500` | Delay between menu clicks (ms) |

## How It Works

1. **Launch** — Opens the application in a Selenium WebDriver browser instance
2. **Discover** — Identifies all menu items (parent + children) from the DOM
3. **Navigate** — For each menu item: clicks it, validates the screen loads, checks menu structure is unchanged, captures screenshot
4. **Validate** — Runs screen validation checks: page load, errors, UI elements, broken components, popups
5. **Report** — Generates structured failure entries and final summary with stability rating

## Output

The framework produces two report formats:
- **Prompt-style** (human-readable) — printed to stdout, suitable for issue trackers
- **JSON** (machine-readable) — for programmatic consumption

Both include per-issue entries with Menu Item, Expected Screen, Observed Behavior, Failure Type, Screenshot path, and Suggested Fix.
