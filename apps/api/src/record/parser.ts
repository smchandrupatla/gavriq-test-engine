/**
 * Parse a `playwright codegen` TypeScript script into declarative Playwright
 * steps the engine's worker runner already understands, with a plain-language
 * narration on each step so a reader with no technical background can follow
 * what the recording does.
 *
 * Codegen's output grammar is small and stable:
 *
 *   test('test', async ({ page }) => {
 *     await page.goto('https://.../login');
 *     await page.getByLabel('Username').fill('analyst');
 *     await page.getByRole('button', { name: 'Sign in' }).click();
 *     await page.getByText('Overview').click();
 *     ...
 *   });
 *
 * We walk each `await page.*` line and emit:
 *   - `navigate` for `page.goto(url)`
 *   - `type` for `.fill(value)` on a located element
 *   - `click` for `.click()` on a located element
 *   - `click_text` for `page.getByText('X').click()`
 *   - `select` for `.selectOption(value)`
 *   - `wait_for` for `.waitFor()`
 *   - `assert_selector_text` for `await expect(locator).toContainText('X')`
 *   - `assert_title` for `await expect(page).toHaveTitle('X')`
 *
 * Each emitted step carries a `selector` that is a Playwright-string the engine
 * runner can hand to `page.locator(...)` directly: role=, label=, text=, CSS
 * (`data-testid=X` for `getByTestId`). The step also carries the plain-language
 * text and expected (what should happen) + testData (what was entered).
 */

export interface RecordedStep {
  action: 'navigate' | 'click' | 'click_text' | 'type' | 'select' | 'wait_for' | 'assert_selector_text' | 'assert_title' | 'assert_no_horizontal_overflow' | 'wait';
  selector?: string;
  value?: string;
  expected?: string;
  must_contain?: string;
  text: string;
  testData?: string;
  max_overflow_px?: number;
}

export interface ParsedRecording {
  startUrl: string | null;
  steps: RecordedStep[];
  /** Warnings about codegen lines we did not know how to translate (kept verbatim as a note). */
  warnings: string[];
}

/** Split codegen output into one "await <page call | expect(...)>" statement per element, flattened. */
function statements(source: string): string[] {
  const out: string[] = [];
  const re = /await\s+((?:page\.|expect\s*\()[\s\S]*?);(?=\s*(?:await|\}|$))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.push(m[1]!.replace(/\s+/g, ' ').trim());
  }
  return out;
}

/** `getByRole('button', { name: 'Sign in' })` → `role=button[name="Sign in"]`. */
function locatorToSelector(expr: string): { selector: string; label: string } | null {
  // page.locator('CSS') — kept as-is
  let m = /^page\.locator\(\s*(['"`])(.+?)\1\s*(?:,[^)]*)?\)/.exec(expr);
  if (m) return { selector: m[2]!, label: m[2]! };

  m = /^page\.getByRole\(\s*(['"`])(\w+)\1\s*(?:,\s*\{\s*(?:name\s*:\s*(['"`])(.+?)\3)?\s*[^}]*\})?\s*\)/.exec(expr);
  if (m) {
    const role = m[2]!;
    const name = m[4];
    return name
      ? { selector: `role=${role}[name=${JSON.stringify(name)}]`, label: `${role} “${name}”` }
      : { selector: `role=${role}`, label: role };
  }

  m = /^page\.getByLabel\(\s*(['"`])(.+?)\1\s*(?:,[^)]*)?\)/.exec(expr);
  if (m) return { selector: `label=${m[2]!}`, label: `field “${m[2]!}”` };

  m = /^page\.getByPlaceholder\(\s*(['"`])(.+?)\1\s*\)/.exec(expr);
  if (m) return { selector: `[placeholder=${JSON.stringify(m[2]!)}]`, label: `field with placeholder “${m[2]!}”` };

  m = /^page\.getByText\(\s*(['"`])(.+?)\1\s*(?:,[^)]*)?\)/.exec(expr);
  if (m) return { selector: `text=${m[2]!}`, label: `text “${m[2]!}”` };

  m = /^page\.getByTestId\(\s*(['"`])(.+?)\1\s*\)/.exec(expr);
  if (m) return { selector: `[data-testid=${JSON.stringify(m[2]!)}]`, label: `element with testid “${m[2]!}”` };

  m = /^page\.getByTitle\(\s*(['"`])(.+?)\1\s*\)/.exec(expr);
  if (m) return { selector: `[title=${JSON.stringify(m[2]!)}]`, label: `element titled “${m[2]!}”` };

  m = /^page\.getByAltText\(\s*(['"`])(.+?)\1\s*\)/.exec(expr);
  if (m) return { selector: `[alt=${JSON.stringify(m[2]!)}]`, label: `image “${m[2]!}”` };

  return null;
}

function strArg(expr: string, after: string): string | null {
  const re = new RegExp(after + "\\s*\\(\\s*(['\"`])(.*?)\\1");
  const m = re.exec(expr);
  return m ? m[2]! : null;
}

export function parseCodegen(source: string): ParsedRecording {
  const steps: RecordedStep[] = [];
  const warnings: string[] = [];
  let startUrl: string | null = null;

  for (const stmt of statements(source)) {
    // page.goto('url')
    let m = /^page\.goto\(\s*(['"`])(.+?)\1\s*(?:,[^)]*)?\)$/.exec(stmt);
    if (m) {
      const url = m[2]!;
      if (!startUrl) startUrl = url;
      steps.push({
        action: 'navigate',
        value: url,
        text: `Open ${url} in a web browser.`,
        expected: 'The page loads without an error.',
      });
      continue;
    }

    // await expect(page).toHaveTitle('...')
    m = /^expect\(\s*page\s*\)\.toHaveTitle\(\s*(['"`])(.+?)\1\s*\)$/.exec(stmt);
    if (m) {
      steps.push({
        action: 'assert_title',
        expected: `The tab title contains “${m[2]!}”.`,
        must_contain: m[2]!,
        text: `Check that the browser tab shows the title “${m[2]!}”.`,
      });
      continue;
    }

    // await expect(locator).toContainText('X') | toHaveText('X')
    m = /^expect\(\s*(page\..+?)\s*\)\.(toContainText|toHaveText)\(\s*(['"`])(.+?)\3\s*\)$/.exec(stmt);
    if (m) {
      const loc = locatorToSelector(m[1]!);
      const want = m[4]!;
      if (loc) {
        steps.push({
          action: 'assert_selector_text',
          selector: loc.selector,
          expected: `The ${loc.label} contains “${want}”.`,
          must_contain: want,
          text: `Check that the ${loc.label} shows “${want}”.`,
        });
      } else {
        warnings.push(`Could not translate selector in: ${stmt}`);
      }
      continue;
    }

    // locator.fill('value')
    m = /^(page\..+?)\.fill\(\s*(['"`])(.*?)\2\s*\)$/.exec(stmt);
    if (m) {
      const loc = locatorToSelector(m[1]!);
      const value = m[3]!;
      if (loc) {
        steps.push({
          action: 'type',
          selector: loc.selector,
          value,
          text: `Type into the ${loc.label}.`,
          expected: 'The entered value appears in the field.',
          testData: value,
        });
      } else {
        warnings.push(`Could not translate selector in: ${stmt}`);
      }
      continue;
    }

    // locator.selectOption('value' | { label: 'X' })
    m = /^(page\..+?)\.selectOption\(\s*(['"`])(.*?)\2\s*\)$/.exec(stmt);
    if (m) {
      const loc = locatorToSelector(m[1]!);
      const value = m[3]!;
      if (loc) {
        steps.push({
          action: 'select',
          selector: loc.selector,
          value,
          text: `Pick “${value}” from the ${loc.label}.`,
          expected: `The ${loc.label} shows “${value}” as the selected option.`,
          testData: value,
        });
      } else {
        warnings.push(`Could not translate selector in: ${stmt}`);
      }
      continue;
    }

    // locator.click() | .dblclick() | .press('Enter')
    m = /^(page\..+?)\.click\(\s*\)$/.exec(stmt);
    if (m) {
      // Special-case page.getByText('X').click() → click_text so the engine's
      // text matching stays identical to codegen's.
      const asText = /^page\.getByText\(\s*(['"`])(.+?)\1\s*(?:,[^)]*)?\)$/.exec(m[1]!);
      if (asText) {
        steps.push({
          action: 'click_text',
          value: asText[2]!,
          text: `Click the text “${asText[2]!}”.`,
          expected: 'The next page or next step of the flow opens.',
        });
        continue;
      }
      const loc = locatorToSelector(m[1]!);
      if (loc) {
        steps.push({
          action: 'click',
          selector: loc.selector,
          text: `Click the ${loc.label}.`,
          expected: 'The next page or next step of the flow opens.',
        });
      } else {
        warnings.push(`Could not translate selector in: ${stmt}`);
      }
      continue;
    }

    // locator.press('Enter') → treat as click on focused + a wait after; simplest: ignore the press, keep flow
    m = /^(page\..+?)\.press\(\s*(['"`])(.+?)\2\s*\)$/.exec(stmt);
    if (m) {
      const loc = locatorToSelector(m[1]!);
      if (m[3] === 'Enter' && loc) {
        // Pressing Enter typically submits a form after a fill — emit a wait
        // the engine can honour.
        steps.push({
          action: 'wait',
          value: '500',
          text: `Press Enter on the ${loc.label}.`,
          expected: 'The form submits.',
        });
      } else {
        warnings.push(`Skipped unsupported key press: ${stmt}`);
      }
      continue;
    }

    // locator.waitFor()
    m = /^(page\..+?)\.waitFor\(\s*(?:\{[^}]*\})?\s*\)$/.exec(stmt);
    if (m) {
      const loc = locatorToSelector(m[1]!);
      if (loc) {
        steps.push({
          action: 'wait_for',
          selector: loc.selector,
          text: `Wait for the ${loc.label} to appear.`,
          expected: `The ${loc.label} is visible.`,
        });
      } else {
        warnings.push(`Could not translate selector in: ${stmt}`);
      }
      continue;
    }

    warnings.push(`Skipped unrecognised codegen line: ${stmt}`);
  }

  return { startUrl, steps, warnings };
}

/** Produce a plain-language title for a recording from its first navigation. */
export function recordingTitle(startUrl: string | null, fallback: string): string {
  if (!startUrl) return fallback || 'Recorded flow';
  try {
    const u = new URL(startUrl);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `Recorded flow on ${u.host}${path}`;
  } catch {
    return fallback || 'Recorded flow';
  }
}
