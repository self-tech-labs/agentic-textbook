# Branch experiments

Test one learning hypothesis per branch. Keep the WebMCP contract, privacy boundary, and desktop event seam comparable.

## `experiment/guided-learning-journey` — implemented

**Hypothesis:** a three-movement interactive lesson document produces clearer completion than a long dashboard-like page.

**Experience:** Notice → Choose → Apply, a numbered rail, page-owned concept figure, one formative choice, one explicit reminder.

**Measure:** start-to-answer time, completion rate, wrong-answer recovery, reminder opt-in, next-week proof of application.

## `experiment/context-packing-lab` — next

**Hypothesis:** an embodied context-packing exercise teaches forking better than a multiple-choice scenario.

**Experience:** the learner selects which four page-owned cards—goal, approved decision, active constraint, definition of done, rejected option, stale assumption, or raw transcript—should cross into a fork. Ogram builds the handoff brief and explains what stayed behind.

**Measure:** correct inclusion/exclusion on first attempt and later creation of clean fork briefs.

## `experiment/resource-led-lessons` — later

**Hypothesis:** one carefully chosen medium improves comprehension when matched to the habit and learner preference.

**Experience:** Codex chooses one validated YouTube link or Ogram walkthrough; the core human choice and apply step remain unchanged.

**Measure:** resource open rate, lesson completion, and transfer relative to the no-resource baseline.

Do not create empty implementation branches until a test is ready to run. This document keeps the comparison intentional without multiplying unfinished code paths.
