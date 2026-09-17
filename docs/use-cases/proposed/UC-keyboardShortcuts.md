# Use documented console keyboard shortcuts

- **ID:** UC-keyboardShortcuts
- **Screen:** Keyboard shortcuts
- **Level:** 1
- **Style:** casual
- **Actor:** SIT / control operator
- **Extends from:** none
- **Extends to:** UC-help

## Goal
Use documented console shortcuts without triggering a destructive action while typing.

## Precondition
1. ux-pack.js is loaded on the Ops Console.
2. A visible save-like control may or may not exist.

## Trigger
Operator presses a documented shortcut while the console has focus.

## Success guarantee
1. The bound action runs only when the target control exists and is visible.
2. Shortcuts are ignored while an input, textarea, select, or contenteditable has focus.

## Minimal guarantee (on failure)
1. A missing save control means Ctrl/Cmd+S does nothing rather than inventing a save.
2. Typing the letter s in a field does not click a screen action.

## Acceptance criteria
1. **AC-01 — Search focus:** Given the operator is not typing in a field, when / is pressed, a visible search field receives focus.
2. **AC-02 — Typing guard:** Given an input has focus, when s is pressed, no shortcut click is fired.
3. **AC-03 — Save when present:** Given a visible enabled Save button exists, when Ctrl+S or Cmd+S is pressed, that save control is activated.
4. **AC-04 — Save absent:** Given no save-like control is visible, when Ctrl+S is pressed, no destructive or invented save occurs.

## Main flow
1. **Actor:** Focuses the console outside an input.
   **System:** No shortcut runs yet.
2. **Actor:** Presses a documented shortcut.
   **System:** Performs the bound action only when the control exists and is visible.

## Alternate flows
1. **A1 — Help FAB:** ? opens the help FAB when that button exists.
2. **A2 — Search:** / focuses a visible search field.
3. **A3 — Escape:** Escape closes the help drawer, help menu, or a dialog close control.
4. **A4 — Go chords:** g then h/d/r/t/s clicks Overview, Datasets, Existing rules, Test Cases or Test Suites by visible label — only if those labels are present.
5. **A5 — Save chord:** Ctrl/Cmd+S clicks a visible Save/Publish/Create/Submit control when one exists.

## Exception flows
1. **E1 — Field focus:** Shortcuts are ignored while an input, textarea, select or contenteditable has focus.
2. **E2 — Missing control:** A missing save control means Ctrl/Cmd+S does nothing.

## Business validation
1. A shortcut listed in Help must match the binding in ux-pack.js.
2. Keyboard bindings require context-specific verification on the live surface.
3. Help text cannot promise a stable decoration letter per action; letters are assigned dynamically and can collide.

## Technical notes / APIs
1. Observed: apps/web/public/js/ux-pack.js and the keyboard-shortcuts help topic in topics.js.
2. This is not a CONFIG.pages entry. Mapping is by help topic id keyboard-shortcuts and documentation key keyboardShortcuts.
3. Classification: observed implementation in ux-pack.js; proposed that Help copy stays in lockstep with that file.

### Screen and action contract
Page key `keyboardShortcuts`. Aliases proposed: `keyboard-shortcuts`. No dedicated HTML route. Surface is the Ops Console plus the Help topic.

### Research and sources
W3C WCAG 2.2 — keyboard, focus, and not moving focus unexpectedly while the user is typing.

### Proposed decisions and open questions
Unresolved: whether single-letter decorations should be frozen per action. Unresolved: whether g-then-* chords should be disabled when labels differ from the five documented names.

## Scenarios
1. Search focus: operator is not in a field; / is pressed; a visible search field is focused.
2. Typing guard: an input has focus; s is pressed; no shortcut click fires.
3. Save when present: a visible Save exists; Ctrl+S activates it.
4. Save absent: no save-like control; Ctrl+S invents nothing.

## Gherkin
```gherkin
Feature: Use documented console keyboard shortcuts

  @UC-keyboardShortcuts @AC-01 @specification
  Scenario: Search focus
    Given the operator is not typing in a field
    When / is pressed
    Then a visible search field receives focus

  @UC-keyboardShortcuts @AC-02 @specification
  Scenario: Typing guard
    Given an input has focus
    When s is pressed
    Then no shortcut click is fired

  @UC-keyboardShortcuts @AC-03 @specification
  Scenario: Save when present
    Given a visible enabled Save button exists
    When Ctrl+S is pressed
    Then that save control is activated

  @UC-keyboardShortcuts @AC-04 @specification
  Scenario: Save absent
    Given no save-like control is visible
    When Ctrl+S is pressed
    Then no destructive or invented save occurs
```
