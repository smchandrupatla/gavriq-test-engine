/**
 * Application key used when a request does not name one. One engine serves many apps, so callers
 * should pass `application_key`; this only keeps older single-app callers working.
 */
export const DEFAULT_APPLICATION_KEY = process.env.DEFAULT_APPLICATION_KEY || 'sand-bench';
