# Branch experiments

Test one learning hypothesis per branch. Keep the WebMCP contract, privacy boundary, and desktop event seam comparable.

## `experiment/shared-learning-instrument` — implemented

**Hypothesis:** repeated learner ↔ Codex co-manipulation of one visible, revisioned object teaches clean forking more effectively than either a chat explanation or a single-pass quiz.

**Experience:** Notice → Practice → Apply. The learner privately packs eight structural cards, explicitly shares immutable `r1`, receives one bounded page-owned Codex note, accepts or dismisses it, and shares `r2` under a new revision-scoped review grant. Codex can annotate or confirm ready but moves zero cards; the learner alone changes the pack and commits the habit contract.

**Measure:** first-attempt rubric state, note acceptance/dismissal, `r1 → r2` improvement, number of revisions to ready, completion, and later creation of clean Codex fork briefs. Privacy telemetry records that a share occurred without recording placements or raw task content.

## `experiment/guided-learning-journey` — implemented

**Hypothesis:** a three-movement interactive lesson document produces clearer completion than a long dashboard-like page.

**Experience:** Notice → Choose → Apply, a numbered rail, page-owned concept figure, one formative choice, one explicit reminder.

**Measure:** start-to-answer time, completion rate, wrong-answer recovery, reminder opt-in, next-week proof of application.

## `experiment/context-packing-lab` — superseded by the shared instrument

**Hypothesis:** an embodied context-packing exercise teaches forking better than a multiple-choice scenario.

**Experience:** this branch proposed a one-person context-packing exercise. Its useful card-sorting hypothesis moved into `experiment/shared-learning-instrument`, where immutable attempts, revision-scoped review cycles, and bounded Codex marginalia make WebMCP essential to the lesson.

**Measure:** correct inclusion/exclusion on first attempt and later creation of clean fork briefs.

## `experiment/resource-led-lessons` — later

**Hypothesis:** one carefully chosen medium improves comprehension when matched to the habit and learner preference.

**Experience:** Codex chooses one validated YouTube link or Ogram walkthrough; the shared practice instrument and learner-owned Apply step remain unchanged.

**Measure:** resource open rate, lesson completion, and transfer relative to the no-resource baseline.

Do not create empty implementation branches until a test is ready to run. This document keeps the comparison intentional without multiplying unfinished code paths.
