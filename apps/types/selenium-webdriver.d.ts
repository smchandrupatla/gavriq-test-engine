// Type-side additions to the loose selenium-webdriver shim in sit/lib/selenium-webdriver.d.ts,
// for apps/selenium-baseline. Kept here because sit/ is synced from Sand Bench. These merge
// with the shim's `const` declarations so `By` / `Builder` also work in type positions.
declare module "selenium-webdriver" {
  export type By = any;
  export type Builder = any;
}

declare module "selenium-webdriver/firefox.js" {
  const firefox: { Options: new () => any; ServiceBuilder: new (path?: string) => any };
  export default firefox;
}

declare module "selenium-webdriver/edge.js" {
  const edge: { Options: new () => any; ServiceBuilder: new (path?: string) => any };
  export default edge;
}
