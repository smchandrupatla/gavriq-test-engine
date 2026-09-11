// Minimal ambient types for selenium-webdriver, which ships no .d.ts for its main
// CommonJS entry points. Loose (`any`-based) on purpose: this is a thin compile-time
// shim so `tsc --noEmit` accepts the imports in sit/lib/selenium.ts, not a full typing
// of the Selenium API. Runtime behaviour is unaffected — sit/cases/*.sit.ts execute
// through tsx, which transpiles without type-checking.
declare module "selenium-webdriver" {
  export const Builder: any;
  export const By: any;
  export const until: any;
  export const Select: any;
  export type WebDriver = any;
  export type WebElement = any;
}

declare module "selenium-webdriver/chrome.js" {
  const chrome: {
    Options: new () => any;
    ServiceBuilder: new (path: string) => any;
    Driver: any;
  };
  export default chrome;
}
