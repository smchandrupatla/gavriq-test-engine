# Find operator help in the Help Center

- **ID:** UC-helpCenter
- **Screen:** Help Center
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-help
- **Surface:** screen

## Goal
Find an operator topic, read its steps, and leave with a PDF or a related topic without changing console data.

## Precondition
1. The operator can open /help-center.html.
2. apps/web/public/help/topics.js exposes window.SBE_HELP_TOPICS.
3. Zero matching topics is a valid search result.
4. Every topic id has apps/web/public/help/pdf/{id}.pdf.

## Trigger
Operator opens /help-center.html or follows a hash link #/{topic-id}.

## Success guarantee
1. The family tree is built from SBE_HELP_TOPICS.
2. A selected topic shows family, title, summary, steps, tips, callouts, warnings, related links, and PDF links.
3. Ops Console form data is unchanged.
4. Download this page and All pages PDF resolve to files that exist on disk.

## Minimal guarantee (on failure)
1. A search with no keyword overlap leaves unmatched families out of the tree rather than inventing a topic.
2. The help bot answers only from stored topics.
3. A missing live model is disclosed by the aside copy “Not a live model.”
4. An unknown hash discloses Topic not found and does not open a substitute article.

## Acceptance criteria
1. **AC-01 — Matching topic:** Given a schema topic exists in SBE_HELP_TOPICS, when the operator types part of its title into #q, that topic remains in the family tree.
2. **AC-02 — No match:** Given no topic title, keywords, or summary contains the query, when search filters the tree, no family with zero hits is shown.
3. **AC-03 — Keyword bot:** Given the operator types a question that overlaps stored keywords, when Ask is activated, the reply cites a stored topic title, summary, and #/{id} link.
4. **AC-04 — Unknown hash:** Given the hash names a topic id that is not in topics.js, when the page renders, absence is disclosed rather than another topic being presented as the requested one.
5. **AC-05 — No form write:** Given the Ops Console had unsaved fields, when Help Center is opened and closed, those fields are unchanged.
6. **AC-06 — Topic PDF exists:** Given a topic id in topics.js, when the operator activates Download this page, /help/pdf/{id}.pdf exists. The header All pages PDF points at sand-bench-help-consolidated.pdf, which also exists, as does Sand-Bench-Help-Manual.pdf.

## Main flow
1. **Actor:** Opens /help-center.html.
   **System:** Renders the header search, family tree, default or hashed topic, and help-bot aside.
2. **Actor:** Searches or selects a topic.
   **System:** Filters the tree on title+keywords+summary and shows the matching topic body.
3. **Actor:** May ask the help bot.
   **System:** Ranks topics by whole-word overlap against title, keywords, and summary; returns the best stored summary.
4. **Actor:** May download a page PDF or the consolidated PDF.
   **System:** Serves /help/pdf/{id}.pdf and /help/pdf/sand-bench-help-consolidated.pdf. Every topics.js id has a matching file.

## Alternate flows
1. **A1 — Empty search:** An empty #q shows every family. Return to main flow step 2.
2. **A2 — Consolidated PDF:** The header All pages PDF link is available without selecting a topic.
3. **A3 — Return to console:** Ops Console link navigates to / and does not write form state.
4. **A4 — Empty bot question:** Ask with a blank textarea returns without logging a turn.

## Exception flows
1. **E1 — No keyword overlap:** ask() returns the stored fallback that it only answers from Help Center topics.
2. **E2 — Unknown hash substitution:** Observed implementation on main: byId(id) returns topics[0] when the id is missing. That substitution is an implementation gap, not accepted success. Tracked on PR #38.
2. **E2 — Unknown hash:** byId returns null. renderUnknown writes Topic not found and does not substitute topics[0].
3. **E3 — Missing topics.js:** If SBE_HELP_TOPICS is absent, topics is []. The tree is empty. The page must not crash the host console because this page is standalone.

## Business validation
1. Help text cannot grant a feature the runtime does not support.
2. Opening Help Center must not modify Ops Console form data.
3. Decision A: empty search results stay empty.
4. The help bot is keyword retrieval, not a live model.

## Technical notes / APIs
1. Observed page: apps/web/public/help-center.html.
2. Observed topics: apps/web/public/help/topics.js (window.SBE_HELP_TOPICS).
3. No Help Center REST API is called by this page.
4. Documentation-only page key helpCenter. Must not be added to FEATURE_PAGES.
5. Binder path map on main already lists help-center.html → helpCenter. A catalogue row must exist or the action stays hidden.
6. Classification: observed implementation for tree, search, bot scoring, and PDF files on disk; proposed behaviour for unknown-hash honesty.
6. Classification: observed implementation for tree, search, bot scoring, and unknown-hash honesty.

### Screen and action contract
Page key `helpCenter`. Route `/help-center.html`. Hash `#/{topic-id}`. Default currentId is `help-center` when the hash is empty. Controls: `#q` search, `#tree` nav, `#page` article, `#bot-q` / `#bot-go` / `#bot-log`. Header links: `/` and `/help/pdf/sand-bench-help-consolidated.pdf`.

### Research and sources
W3C WCAG 2.2 — status messages and keyboard access for search and the Ask control. Help Center copy states the bot is not a live model.

### Proposed decisions and open questions
Unresolved on main: whether byId should render an explicit unknown-topic state instead of topics[0] (PR #38). Help screenshot files under help/img/ are referenced and not certified. Do not merge this key into FEATURE_PAGES.
Unresolved: whether every topics.js id has a matching PDF on disk. Do not merge this key into FEATURE_PAGES.

## Scenarios
1. Matching topic: a schema topic exists; the operator searches its title; that topic remains in the tree.
2. No match: no topic matches the query; search filters the tree; no empty family is shown.
3. Keyword bot: the operator asks how to import a scheme; Ask runs; the reply cites a stored Import schema topic.
4. Unknown hash: the hash is not a topic id; the honest specification is to disclose absence. Current main code substitutes topics[0].
5. Topic PDF: import-schema is in topics.js; /help/pdf/import-schema.pdf exists.
4. Unknown hash: the hash is not a topic id; the page discloses Topic not found and does not open topics[0].

## Gherkin
```gherkin
Feature: Find operator help in the Help Center

  @UC-helpCenter @AC-01 @specification
  Scenario: Matching topic
    Given a schema topic exists
    When the operator searches its title
    Then that topic remains in the tree

  @UC-helpCenter @AC-02 @specification
  Scenario: No match
    Given no topic matches the query
    When search filters the tree
    Then no family with zero hits is shown

  @UC-helpCenter @AC-03 @specification
  Scenario: Keyword bot
    Given the operator asks how to import a scheme
    When Ask is activated
    Then the reply cites a stored Import schema topic

  @UC-helpCenter @AC-04 @specification
  Scenario: Unknown hash
    Given the hash names a topic id that is not in topics.js
    When the page renders
    Then absence is disclosed rather than another topic being presented as the requested one

  @UC-helpCenter @AC-06 @specification
  Scenario: Topic PDF exists
    Given import-schema is a topic id
    When the operator activates Download this page
    Then apps/web/public/help/pdf/import-schema.pdf exists
```

## Issue log
1. **ISS-02** [fixed] Per-topic and consolidated PDFs were linked but missing from the tree — every topics.js id now has help/pdf/{id}.pdf; consolidated and Sand-Bench-Help-Manual.pdf are checked in (updated 2026-09-12).
1. **ISS-01** [fixed] help-center.html byId(id) returned topics[0] for an unknown hash, substituting an unrelated article — byId returns null and renderUnknown discloses Topic not found (updated 2026-09-12).

## History
| Date | Author | ChangeType | Summary | Rationale | FilesChanged | TestsAdded | VerificationEvidence | FollowUps | ReviewerSignOff |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-12 | use-case agent | fix | Ship per-topic help PDFs | Help Center and help-bind already linked files that were absent | apps/web/public/help/pdf/*, apps/web/public/Sand-Bench-Help-Manual.pdf, tests/help-center.test.ts, apps/api/src/modules/useCaseReviewStandalone.ts, docs/use-cases/proposed/UC-helpCenter.md | tests/help-center.test.ts asserts every topic id has a PDF | existsSync on each topics.js id plus consolidated and manual | Help img files still unverified; unknown-hash on PR #38 | |
| 2026-09-12 | use-case agent | fix | Unknown hash discloses absence | AC-04 was specified; topics[0] substitution was the live bug | apps/web/public/help-center.html, apps/api/src/modules/useCaseReviewStandalone.ts, docs/use-cases/proposed/UC-helpCenter.md, tests/help-center.test.ts | tests/help-center.test.ts unknown-hash assertion | Source no longer contains `|| topics[0]`; review exception matches AC-04 | Per-topic PDF existence still unverified | |
