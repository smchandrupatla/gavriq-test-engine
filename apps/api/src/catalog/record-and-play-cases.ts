/**
 * Record & play — user-recorded screen test cases.
 *
 * The catalog TypeMeta + per-application suite stub for recordings captured by
 * the engine's screen recorder. The recordings themselves are NOT shipped here:
 * they are created by the user through `POST /api/v1/record/stop` which saves
 * them as `created_by = 'record-and-play'` rows via the normal test-case path.
 * Reseeds leave those rows alone (the prune step archives only rows created
 * by `realistic-catalog`), so a recording survives a seed run.
 *
 * The TypeMeta lights up the "Record & play" submenu on every application the
 * suite is registered for; the suite is the default parent of a recorded case.
 */
import type { SuiteDef, TypeMeta } from './types.js';

export const RECORD_AND_PLAY_TYPE: TypeMeta = {
  key: 'recordAndPlay',
  label: 'Record & play',
  subtitle: 'Screen flows captured in a real browser and replayed step by step.',
  category: 'qa',
};

/** The default suite each application's recordings land in. */
export function recordAndPlaySuite(appKey: string): SuiteDef {
  return {
    key: `${appKey}-record-and-play`,
    name: 'Record & play recordings',
    description:
      'Screen flows a user captured by driving the application in a real browser. Each case stores the URL, the actions, the data entered and the state of the page before the recording started, so a replay follows exactly what the user did.',
    typeKey: RECORD_AND_PLAY_TYPE.key,
    category: 'qa',
  };
}
