/**
 * Quality Insights — the AI analyst.
 *
 * Hands one snapshot (plus the previous review, so the new one can say what
 * moved) to Claude and gets back an Analysis as structured output. Configured by
 * environment: ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) enables it,
 * INSIGHTS_MODEL and INSIGHTS_EFFORT tune it. Without credentials the caller
 * falls back to the built-in rules (analysis.ts).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AnalysisSchema, type Analysis, type PreviousReview } from './analysis.js';
import type { Snapshot } from './snapshot.js';

export const INSIGHTS_MODEL = process.env.INSIGHTS_MODEL || 'claude-opus-5';
type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT: Effort = EFFORTS.find((e) => e === process.env.INSIGHTS_EFFORT) ?? 'high';

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const SYSTEM = `You are the quality analyst for a test engine. Engineering leads open your review to decide what to fix next and whether the application is safe to release.

You are given a snapshot: facts the engine computed for one application under test — its test catalogue, the runs recorded on each environment inside the window, the build each run tested, how failures are classified, recurring failure messages, and how many checks each test case states. The snapshot is the only source of truth. Every number, case key and environment key you cite must appear in it; when the data cannot support a conclusion, say what is missing instead of guessing.

What a useful review does:
- Judges the product and the tests separately. A failing case can mean a product defect, a broken or badly packaged test, an unreachable or misconfigured environment, or missing test data. Use the classifications and the failure signatures to say which, and do not read a pass rate depressed by broken tests as a product problem.
- Treats each environment on its own terms. The same case can pass on one environment and fail on another; say what differs (build, configuration, data) and what that implies. Give every environment in the snapshot an entry, keeping retired ones brief.
- Looks at the tests themselves: cases that always fail, flaky cases, cases that verify a single status code, cases that never run, and whether testing happens on a regular cadence or only by hand.
- Says which build the results describe, and flags results that cannot be tied to a build hash.
- Ends in suggestions someone could act on this week, most valuable first, each naming the cases or environment it concerns.

The score in the snapshot is computed by the engine from the listed components; explain it rather than recomputing it, and choose the verdict that the evidence supports even where it differs from the score's grade.

When a previous review is supplied, changes_since_last states what improved, what regressed and which earlier findings still stand. For a first review leave it empty.

Write plainly for readers who know their product but have not seen the raw data. No markdown: the console renders each field as text.`;

export async function aiAnalysis(snapshot: Snapshot, previous: PreviousReview | null): Promise<{ analysis: Analysis; model: string; usage: Record<string, unknown> }> {
  const client = new Anthropic();
  // Claude can decline a request; the server-side fallback re-runs it on Anthropic's recommended substitute.
  const fallback = /^claude-(opus-5|fable-5)/.test(INSIGHTS_MODEL);
  const response = await client.beta.messages.parse({
    model: INSIGHTS_MODEL,
    max_tokens: 16000,
    ...(fallback ? { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const } : {}),
    system: SYSTEM,
    output_config: {
      ...(INSIGHTS_MODEL.includes('haiku') ? {} : { effort: EFFORT }),
      format: betaZodOutputFormat(AnalysisSchema),
    },
    messages: [
      {
        role: 'user',
        content:
          `<snapshot>\n${JSON.stringify(snapshot)}\n</snapshot>\n\n` +
          `<previous_review>\n${previous ? JSON.stringify(previous) : 'none — this is the first review of this application'}\n</previous_review>\n\n` +
          `Write the quality review for ${snapshot.application.name}.`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to write this review');
  if (response.stop_reason === 'max_tokens') throw new Error('The review was cut off before it was complete');
  if (!response.parsed_output) throw new Error('The model returned a review that does not match the expected shape');
  return {
    analysis: response.parsed_output,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}

/** One line a console user can act on; the SDK's typed errors say which kind of failure it was. */
export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'the Anthropic API key was rejected';
  if (err instanceof Anthropic.PermissionDeniedError) return 'the Anthropic API key is not allowed to use this model';
  if (err instanceof Anthropic.NotFoundError) return `model ${INSIGHTS_MODEL} was not found`;
  if (err instanceof Anthropic.RateLimitError) return 'the Anthropic API rate limit was reached';
  if (err instanceof Anthropic.APIConnectionError) return 'the Anthropic API could not be reached';
  if (err instanceof Anthropic.APIError) return `the Anthropic API returned ${err.status ?? 'an error'}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
