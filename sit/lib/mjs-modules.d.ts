// The SIT helper modules under sit/lib are plain JavaScript (.mjs) so the same files run under
// node, tsx and the SIT console. Treat imports of them as untyped instead of failing the
// typecheck with TS7016 for every case file that uses one.
declare module "*.mjs";
