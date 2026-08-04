# Atlas — Build Log

Complete record of everything built so far: every file, every decision and why, every component's exact props, every data field, every accessibility feature, every bug caught during validation, and everything deliberately deferred. Written as project documentation, not just a chat recap — meant to be readable on its own by you or a future session.

Current state: **65 files, ~14,340 lines of HTML/CSS/JS.** Static site, zero build step, zero backend, deployable to GitHub Pages as-is.

> **Note on this log's own gap:** this file stopped at §1.5 (Projects M1), but the repository itself already contained working Notes and Calendar modules (`js/notes/`, `js/calendar/`) that were never written up here — the code shipped, the log entry didn't. That's a documentation lag, not a missing feature. §1.6 below picks up from the actual current state rather than pretending Notes/Calendar don't exist (§9 previously made that same stale claim). Sections 2/4/5 are updated with Habits' own additions; the Notes/Calendar entries those sections are still missing are a separate backfill this log doesn't attempt, since reconstructing another module's design decisions after the fact isn't something to invent.

---

## 1. Timeline

### 1.1 — Landing page + application shell
No landing page existed anywhere in the project or uploads at the time — checked `/mnt/project` and `/mnt/user-data/uploads` directly rather than assuming, per the standing rule to verify before building. Built one from scratch using the design tokens already specified in `ATLAS_FOUNDATION.md` §7, plus the full app shell: sidebar, top nav, workspace switcher, command palette, dashboard, settings.

Key decisions made here, still load-bearing for everything after:
- **Hash-based routing** (`#/dashboard`, `#/projects`, …) instead of path-based routing — a client-routed static SPA with path-based routes 404s on hard refresh under GitHub Pages unless you add server rewrite rules, which a no-build static site can't easily do. Hash routing sidesteps this entirely.
- **Native ES modules**, one file per responsibility, no bundler — chosen specifically so the code maps 1:1 onto future React components/hooks when Atlas eventually moves to Next.js per the Foundation roadmap, without pretending this is React today.
- **Hand-built inline SVG icons** (24px grid, 2px stroke, round caps — Lucide's visual language, not its exact path data) instead of a CDN icon font/library — zero runtime dependency, zero icon-flash on load.
- **A small custom observable store** (`store.js`) instead of any state library — get/set/subscribe, backed by `localStorage` for theme, workspace, and sidebar-collapsed state (deliberately *not* persisting whether the mobile drawer is open).
- **Signature accent color** `#3654E0` — chosen deliberately over the two most common "this looks AI-generated" defaults (warm-cream-and-terracotta, or near-black-and-neon) and over generic Tailwind-indigo. Paired with a warm-tinted neutral gray scale rather than cold gray.
- **The command palette as the one signature moment** — real ARIA combobox/listbox semantics (not a fake lookalike), arrow-key navigation, unified so the topbar's search pill and ⌘K open the exact same overlay instead of two competing systems.
- Landing page hero **shows** the product's ambient-AI/quick-capture pillar instead of describing it — a live typewriter demo cycling through example inputs ("call sarah tomorrow 3pm" → parsed task) rather than a generic hero stat block.

### 1.2 — GitHub Pages upload issue
Screenshot showed the whole `atlas-site` folder nested one level inside the repo instead of its contents sitting at the root, so `index.html` wasn't where Pages looks for it. Diagnosed as a drag-and-drop artifact (uploaded the outer folder instead of its contents) and flagged that `.nojekyll` is a dotfile some file pickers hide from drag-and-drop, so it may not have made it in.

### 1.3 — Real landing page wiring
You uploaded the actual pre-existing `atlas-landing.html` — a full marketing/waitlist page that hadn't been visible to me in step 1.1. Found both CTAs (`nav__cta` line 1115 "Get early access", hero `btn-primary` line 1143 "Start building") pointing at `#cta`, an email-capture anchor, instead of the app. Gave the exact two-line fix (`href="app/index.html"`) and flagged that this file is fully self-contained (styles/script inlined) and doesn't touch the `css/`/`js/`/`assets/` folders at all.

### 1.4 — Dashboard rebuilt on reusable components ("Day 6")
You gave a full component-system spec (StatCard, SectionCard, 5 list-item types, Progress, Badge, QuickActionButton, EmptyState) with "take every part of the prompt easily, don't assume anything." Four real ambiguities in that spec were resolved explicitly rather than silently:
1. **Quick Actions: 4 items or 6?** The component spec's examples listed 6; the actual dashboard-layout section listed 4 and required a clean 2×2 grid on mobile. 6 doesn't tile into 2×2; 4 does — went with 4.
2. **TaskItem's "due time"** wasn't in the component's own prop list but was required by the layout section — added as an extra optional prop rather than dropped.
3. **Habit "completion ring or progress"** — ambiguous phrase. Implemented *both* readings: a weekly completion Progress bar and a separate daily "done today" toggle, rather than guessing one.
4. **Empty-state duplication** — unified the existing full-page empty state and a new compact in-card one into a single `emptyState()` function with a `size` variant, instead of two parallel implementations.

Built `js/components.js` as the shared library; rewrote `views.js` entirely around it; renamed `.panel`→`.section-card` and `*-row`→`*-item` throughout for naming consistency (checked afterward that no old names were left anywhere). Built a real 12-column CSS Grid for the desktop layout with three genuine responsive tiers (not one breakpoint doing double duty). Refactored the Settings page to also use `SectionCard`, proving the components work outside the dashboard too.

Two real bugs caught by validation and fixed: a dead `--space-20` CSS variable that always fell back to `--space-16` anyway (simplified to just use `--space-16`), and a missing `.quick-action__label` CSS rule.

### 1.5 — Projects module, Milestone 1
Spec was written in React vocabulary (`<ProjectCard>`, hooks, memoization, lazy-loaded views) for a project that's still plain HTML/CSS/JS. Translated rather than ignored: components → functions(props); hooks/state → the same store pattern; memoization → a real cache, not a claim; lazy-loaded views → a genuine dynamic `import()`.

Scope was split into a milestone rather than attempting all 22 named components, 3 views, and drag-and-drop shallowly in one pass (per your own instruction not to exhaust the response budget recklessly, and the standing project rule to break oversized requests into milestones). Built completely: data model + 14 realistic projects, both color systems, all 4 Progress variants, 11 of the Projects components, the Grid view, a full toolbar (search/new/view-switcher/filter/sort), and a real slide-in detail panel. Explicitly deferred: List/Kanban views, drag-and-drop, the New Project form, Import/Export, and several filter facets (see §9).

Consolidated the dashboard's "Recent Projects" section to read live from this new canonical dataset instead of keeping a second, separately-maintained copy that had already drifted (its old mock statuses, "Active"/"Paused", didn't even match the new official 7-status list).

One real bug caught and fixed during validation: the filter/sort memoization cache didn't invalidate when a project's own data mutated (e.g. archiving a card from its action menu), so toggling archive while "show archived" was off wouldn't actually have removed it from the grid. Added an explicit `invalidateVisibleProjectsCache()` call at the one place that mutates project data.

### 1.6 — Habits module, Milestone 1
Spec was written for a stack this project doesn't use — React components, TypeScript models, Framer Motion — same situation as Projects (§1.5) and (presumably) Calendar. Translated the same way: components → `functions(props)`; TypeScript interfaces → JSDoc `@typedef` comments; Framer Motion → CSS transitions/keyframes on the existing motion tokens (already covered by the global `prefers-reduced-motion` override in `base.css`, so no extra per-component handling was needed); "virtualized history lists" / "code splitting" → the same genuine dynamic `import()` code-splitting Projects/Notes/Calendar already use (true list virtualization is moot this milestone since the History/Timeline view is deferred, see §8).

**Three things flagged and decided explicitly rather than silently picked:**
1. **Gamification tension.** The landing page's own Habits pillar copy says *"simple daily and weekly streaks, without a gamified layer getting in the way"* — but the spec asks for a full Achievements/badge-unlock system with unlock animations and "micro confetti." Built the streak/heatmap/stats mechanics (closer to GitHub-contributions data visualization than gamification) but deferred the Achievements system entirely rather than build something the product's own stated positioning argues against. The CompletionButton still has a small satisfying pop on completion (checkmark draw + scale), just not confetti or unlockable badges.
2. **A second calendar would duplicate the first one.** The spec's own `CalendarView` ask (Week/Month/Day views inside Habits) would re-implement what the real Calendar module already does — and Calendar's `repository.js` was *specifically* built with a `{ id, getEvents(start,end) }` adapter seam for exactly this case. Registered Habits as a real source there instead (see Integrations below) and did not build a second calendar UI. Weekly Overview and the monthly heatmap are a different thing (completion-history visualization, not scheduling) and are Habits' own.
3. **"Today's Habits" + "Habit Categories" are the same list, not two.** Rendered as one list grouped by category with collapsible section headers — covers both spec sections without maintaining two parallel views of the same 11 habits.

**Built completely:** data model (`Habit`, `HabitCompletion`, category/frequency/priority config) + 11 mock habits spanning all 9 categories with a *generated* (not hand-authored) ~90-day completion history — a deliberate difference from Projects/Notes/Calendar's static-dated mock data, since a habit's history is a time series that should still look coherent whenever the app is actually opened, not just on the day it was authored. Streak math (current/longest, with 'skipped' as a non-breaking grace day), 30-day success rate, week-over-week trend, a 12-metric dashboard, rolling 7-day weekly overview (click a day for a detail breakdown), a GitHub-style monthly heatmap with month/year navigation, current+longest streak leaderboards, full search/filter(category/priority/status/favorites)/sort(8 options), and a complete create/edit dialog (frequency incl. custom weekday picker, optional reminder, optional goal, priority, tags, linked project, archive toggle).

**Integrations — real, not simulated:**
- **Dashboard.** "Current Streaks" section and the Habit Streak stat card now compute live from this module (retiring the old hardcoded 2-habit array and its static "12 days" stat value).
- **Calendar.** `adaptHabitReminders` in `calendar/repository.js` — which previously had to synthesize a fake per-habit reminder time because Habits had no real schedule data yet — now reads each habit's actual `frequency`/`reminderTime`, respecting weekdays/weekends/custom schedules instead of assuming daily for everything.
- **Projects.** Optional `linkedProjectId` field, surfaced as a dropdown in the create/edit dialog.
- **Goals, Learning (as an integration target), AI Assistant, Notifications, Analytics.** None of these exist as real modules yet (Goals isn't built at all; Learning/AI Assistant/Notifications/Analytics have no engine to integrate with) — no fake integration was built against them. The data model does carry an unused, nullable `goalId` so a future Goals module can link without a schema migration.

**Also promoted `ProgressRing` to the shared component library** (`js/components.js`) — it previously existed only as one branch of Projects' own `ProjectProgress('ring')`. Habits needed the identical ring for several rings on its header, so the SVG logic itself moved up (Projects' `ProjectProgress` now delegates to it) rather than getting a second copy. Same reasoning as the existing `dateKey`/`monthGridDays` family, which made the identical move from `calendar/state.js` into the shared `date-utils.js` this same milestone, once Habits' heatmap needed the exact same month-grid math Calendar's month view already had.

**Two real bugs caught by validation, not hypothetical ones:** `habit-dialog.js` was scroll-locking the body via a CSS class (`overlay-open`) that doesn't exist anywhere in the stylesheet — the actually-established pattern (used by both `calendar/event-panel.js` and `projects/view.js`) is a direct `document.body.style.overflow` toggle; fixed to match it. Separately, the weekly-overview day-detail popover referenced seven per-color icon-chip classes (`weekly-overview__detail-icon--blue`, etc.) that were never defined — added all seven.

**This milestone's validation also added a step beyond §7's existing methodology:** actually executing `habits/data.js` + `habits/state.js` in Node against the real generated mock data (streak math, dashboard stats, heatmap, weekly overview, filter/sort, full CRUD round-trip, the completion click-cycle) rather than relying on static analysis alone. Worth keeping for future modules with this much computed logic — static checks catch wiring mistakes, not wrong math.

### 1.7 — Goals module, Milestone 1
Same React/TypeScript/Next.js-flavored spec translation as Projects/Habits before it (§1.5, §1.6) — this one even more explicitly, since the spec's own architecture section asked for `modules/goals/{pages,hooks,services,store,api,animations,...}`. Translated the same way: no hooks/store/api/pages folders (there's no backend or router that needs them), just `data.js`/`state.js`/`components.js` plus two view files, same shape as every other module.

**The spec's own "Goal Types" and "Goal Categories" sections conflicted** — Financial Goals vs. a Finance category, Academic vs. Education, Health vs. Health, Personal vs. Personal, with Professional/Life on top — two lists that can't both be a single-select field on the same goal without fighting each other. Resolved as two separate axes instead of picking one list over the other: `category` (the 17-item domain list, kept whole) and `timeframe` (just the time-horizon subset — Daily/Weekly/Monthly/Quarterly/Annual/Short-term/Long-term), dropping the domain-flavored entries from the original "Goal Types" list since `category` already covers that ground.

**Fields the spec asked for that don't exist here, and why:** `coverImage` and milestone/goal `attachments` would need real file storage, which this app doesn't have (same reasoning Projects/Habits gave for not faking Import/Export). `visibility` is dropped too — there's no auth/multi-user system for "private vs. shared" to mean anything yet. Milestone `dependencies` and nested sub-milestones are deferred, not dropped (see §8) — genuine added complexity (cycle detection, a dependency-aware UI) beyond what a first milestone needs.

**Built completely:** data model (`Goal`/`Milestone`/`Subtask`, JSDoc typedefs), config (17 categories, 7 timeframes, 8 statuses, the shared 4-tier priority — see promotions below), and **16 mock goals** (a stated, smaller stand-in for the spec's "at least 40/150/300" — see Mock Data below) spanning every category and status, each with **procedurally generated milestones/subtasks and a generated progress-history time series** — same reasoning as Habits' generated completion history: a goal's progress-over-time is a time series that should still look coherent whenever the app is opened, not a fixed snapshot from whenever it was authored.

A real progress cascade (measurable target/current → milestone-average → manual override, whichever applies to a given goal), a genuine **forecast engine** (trailing-window velocity, a confidence score from how consistent that velocity has been, required-pace-vs-deadline risk assessment), full milestone + subtask CRUD with auto-completing a milestone once every subtask is checked, an activity log that's a real append-only record (not re-derived), search (title fuzzy-matched, everything else plain substring — see the bug note below), filter (status/category/timeframe/priority/favorites/archived) and sort (9 options, including by risk and forecast confidence, both real numbers), a grid view with cover-gradient cards, and an immersive detail panel (progress ring, forecast widget, milestones with inline subtask checklists, three kinds of linked entities, an editable notes field, activity feed).

**The spec's "AI Suggestions (UI-ready)" became a plainly rule-based Insights line, not literal AI.** `generateInsight()` is a straightforward set of conditions over the same forecast numbers the widget already shows (behind pace, past deadline, no milestones started yet, on track) — useful, but calling a conditional over already-computed numbers "AI" would be a real misrepresentation of what's actually running. If genuine AI analysis gets built later, this function is the exact seam it replaces.

**Three views became one.** The spec asked for Grid, List, and an animated zoomable Timeline/Roadmap with dependency lines. Built Grid only; List is deferred the same way Projects deferred it (§8 below), and Timeline/Roadmap is this milestone's biggest deferral — a real zoomable, dependency-aware roadmap is substantial standalone scope, the same category of decision as Calendar deferring Week/Day views or Habits deferring a second calendar.

**Integrations — real, not simulated:**
- **Calendar.** `adaptGoalDeadlines` registered in `calendar/repository.js`'s existing source registry (the same `{ id, getEvents(start, end) }` seam Projects and Habits already use) — both a goal's own deadline and every *open* (not-yet-completed) milestone deadline show up on the real Calendar.
- **Dashboard.** A new "Upcoming Goal Deadlines" section, computing live from this module via the exact same `getUpcomingDeadlines()` function the Goals page itself uses — not a separate, drifting copy.
- **Projects, Habits, Notes.** All three are real, ID-based links (multi-select in the create/edit dialog), shown in the detail panel with live data pulled from each module directly — a linked habit shows its actual current streak, a linked project its actual status and progress, computed at render time, not copied in.
- **Learning, Finance.** Neither exists as a real module yet, so neither got a fake integration. No placeholder field was added for either (unlike Habits' `goalId`, there wasn't a clear signal these were coming next).

**Component promotions this milestone** (same "two modules need the identical thing" bar as ProgressRing in §1.6): `PriorityBadge` and its `PRIORITY_CONFIG` (Low/Medium/High/Critical) out of Projects' own `ProjectPriority`; `DeadlineBadge` out of Projects' own `ProjectDeadline`; the header "label + bold number" strip out of Habits' page header, now `.header-summary` in `components.css`. All three follow the exact pattern already established: the original module now delegates to the shared version instead of keeping a second copy, and the CSS moved with it (renamed, not duplicated). A new `GoalItem` dashboard-preview component was added alongside the existing `TaskItem`/`ProjectItem`/`NoteItem`/`HabitItem` family, reusing `.project-item`'s CSS directly since the shape is identical.

**Mock data volume — stated, not silent.** 16 goals, 44 milestones, ~120 subtasks stand in for the spec's "at least 40/150/300." Hand-authoring that many literal objects wasn't the honest move here (150 milestones written out by hand would drift and be unmaintainable); a smaller, *procedurally generated* set — same technique as Habits' completion history — covers every category/status/timeframe combination and is easier to verify than pretending to hit an arbitrary count.

**Real bugs caught by validation, not hypothetical ones:**
- The "fuzzy" search matched a query as a subsequence against one giant concatenated string (title + description + tags + every milestone title). Against a long enough haystack, almost any short query is trivially a subsequence somewhere — searching "software" matched five unrelated goals, none containing that word. Fixed by restricting fuzzy matching to the title alone (short enough for it to mean something) and using plain substring matching for everything else.
- `generateInsight()` had no case for a `Cancelled` goal, so it fell through to the default "on track" message — wrong for something that's been cancelled. Added the missing case.
- The Timeframe filter's checkboxes were wired into the popover UI before the underlying `timeframeFilter` state field, the `filterGoals` check for it, and the memoization cache key all existed — so checking a Timeframe box would silently do nothing. Added all three pieces.
- `habit-dialog.js`'s pattern-turned-mistake showed up again here as a new one: `wireDetailInteractions()` re-runs on every single interaction inside the goal detail panel (a subtask toggle, a milestone completion), and it was attaching a fresh `document`-level click listener each time rather than once — an accumulating leak, one extra harmless-but-wasteful listener per click. Moved that listener to the panel's one-time `initGoalDetail()` instead.
- Related: the detail panel's own refresh path was re-running the *full* open sequence on every interaction, which force-focuses the close button each time — checking off three subtasks in a row would yank keyboard focus back to the close button after each one. Split "open" (focuses the close button, once) from "re-render in place" (no focus changes) so interacting with an already-open panel doesn't fight the user's focus.
- Milestone deadlines were originally spaced on a fixed 14-day cadence from a goal's `createdAt`, regardless of how far away its actual deadline was — fine for a goal due soon, but for a goal like "Graduate University" (created 300 days ago, due in 280 more) it clustered every milestone in the first ten weeks and left a ten-month gap before the goal's own deadline. Once these started showing up on the real Calendar this was obviously wrong. Fixed to space milestones proportionally across the goal's actual createdAt-to-deadline span.
- Two CSS misses: `--space-20` doesn't exist in `tokens.css` (only 4/8/12/16/24/32/48/64/96 do) — used in the detail panel header's padding; and the header-summary promotion (previous bullet point) initially left both Habits' and Goals' own header container `<div>`s pointing at a class name that no longer had a CSS rule after the move. Both fixed.

---

### 1.8 Day 14 — Books (Milestone 1)

The incoming spec asked for something closer to Goodreads + Kindle Library + Readwise + StoryGraph + Notion combined — by a wide margin the largest single request so far, and written entirely in a different stack again: TypeScript, a `pages/components/hooks/services/types/utils/constants/helpers/store/api/mock/assets` folder tree, Framer Motion, and mock-data minimums (60 books, 25 authors, 200 sessions, 75 quotes, 100 highlights…) sized for a real product, not a portfolio milestone. Same translation rules as every prior spec, applied again: TypeScript interfaces → JSDoc `@typedef` comments; the React folder tree → the same flat `data.js` / `state.js` / `components.js` / `view.js` (+ `book-dialog.js`, `book-detail.js`) split every other module already uses; Framer Motion → the existing CSS transition tokens; "production-quality, ships to thousands of users" → a real, working milestone, scoped and documented like the others. The standing rule about not attempting an oversized spec in one pass applied here more than ever — what follows is a genuinely complete Milestone 1, not a thin slice of everything.

**Decisions made, not defaults silently picked:**
- **No emoji icons anywhere in this module.** Explicit instruction this round, and it cuts against Goals'/Projects' own convention of a user-chosen emoji as a card's identity icon — a deliberate divergence for Books specifically, not a correction to those two. `BookCover` uses an identity color + the title's first letter instead of an icon at all; `Collection.icon` (the one place this module has an icon-picker-shaped field, same role Goals'/Projects' own `icon` plays) uses an SVG icon name from the existing set instead of an emoji glyph. Two new SVG icons (`quote`, `highlighter`) were added to `icons.js` in the same 24px/2px-stroke style rather than reaching for a glyph for either.
- **One new color token**, `--identity-yellow` — added only because nothing existing fit: the spec's six Highlight colors (Yellow/Green/Blue/Pink/Purple/Orange) map cleanly onto five of the app's seven identities (Green→emerald, Blue→blue, Pink→rose, Purple→violet, Orange→amber) but none of the seven is a true yellow.
- **No separate Author or Collection pages.** Same reasoning Goals gave for dropping `coverImage`: there's no file storage for author photos, and a full profile/bio CRUD surface for 13 mock authors is a lot of scaffolding for something the spec's own "Author profiles" section doesn't make load-bearing anywhere else. Authors are plain strings on each book; Collections are real data with a working add/remove toggle from Book Detail, but their own dedicated management UI is deferred (§8).
- **One filterable Library grid, not five separate pages.** The spec listed Currently Reading / Want to Read / Completed / Favorites as distinct top-level pages, each with a differently-shaped card. `BookCard` instead adapts its own primary row to the book's status (a progress ring for Currently Reading/Re-reading, star rating + completion date for Completed, date-added for Want to Read), and status is a filter facet like everywhere else in this app — with the dashboard's stat cards doing double duty as one-click shortcuts into a given filter, which is new here (Goals'/Habits'/Projects' own stat cards are read-only).
- **`BookActivity`/`BookTimeline` are computed on demand, never stored.** Books has more distinct event types (session/quote/highlight/note/status) than Goals' own `activity[]` array had to cover, so storing a parallel log would just be duplicating sessions/quotes/highlights/notes a second time. `buildBookActivity()` merges all four live, sorted, every time the panel opens.
- **No parallel `ReadingGoal` entity.** A book links to the real Goals module (`linkedGoalIds`) instead — Goals' own mock data already had a "Read 500 Books" goal (`g6`) waiting for exactly this.
- **`targetFinishDate` (nullable)**, a field the spec didn't name directly — added because without a real per-book deadline there was nothing for the Calendar "Deadlines" integration to hook into. Same role Project/Goal deadlines already play.
- **Book titles and authors are entirely invented**, not real books. Partly the same reasoning as everywhere else (no ISBN/cover-lookup API exists to call), but mainly so that invented Quote/Highlight text attached to them never risks reading as a fabricated "verbatim excerpt" from an actual, currently-copyrighted work — a real book/author combination with made-up quotes attached would be that regardless of framing.

**Three components promoted to the shared library**, same bar as `ProgressRing`/`PriorityBadge`/`DeadlineBadge` before them — a second consumer needing the identical thing, not a hypothetical one:
- `HeatmapGrid`, out of Habits' own monthly completion heatmap — Books' reading heatmap needed the exact same GitHub-style grid. Cells can now carry an optional pre-built `label`, a small generalization so Books' "45 pages read" phrasing doesn't have to fake Habits' "%(done/due)" framing; Habits' own cells never set it, so its output is byte-for-byte unchanged.
- `LinkedEntityChip` and `ForecastPill`/`ForecastWidget`, out of Goals — Books' own Goal/Project/Habit cross-links reuse the chip directly, and Books' reading-pace forecast (velocity in pages/day → a likely finish date → a risk level once a real `targetFinishDate` exists) is the same shape of computation Goals' progress-velocity forecast already was. `ForecastWidget` picked up one optional `velocityLabel`/`requiredPaceLabel` override so Books can show "pages/day" instead of Goals' original "%/day"; omitted, it falls back to the exact original formatting. One small side effect: `ForecastPill`'s "No deadline set" text became the slightly more generic "No target set," since one string is now shared by both modules' empty states.
- All three source modules (`habits/components.js`, `goals/components.js`) now re-export from the shared file instead of keeping a second copy — every existing import elsewhere in those modules kept working unchanged.
- None of the three needed their CSS to move anywhere: every module's stylesheet is already linked globally in `app/index.html`'s `<head>`, so `.heatmap*` (still physically in `habits.css`) and `.linked-chip`/`.forecast-pill`/`.forecast-widget` (still in `goals.css`) apply to Books' markup with zero duplication.

**Built completely:**
- Data model — `Book`, `ReadingSession`, `Quote`, `Highlight`, `BookNote`, `Collection`, plus a `Review` embedded on the book (not a separate entity, since it's 1:1 with a completed book). Full JSDoc typedefs.
- **24 books** (a stated, smaller stand-in for the spec's "at least 60," same reasoning as Goals' 16-for-40) across all 7 statuses, 13 invented authors (several writing 2–3 books each so "Most read author" means something), all 19 of the spec's default genres, 6 collections.
- **97 generated reading sessions** (stand-in for "200"), 16 quotes, 31 highlights, 14 notes — via the same seeded-random-plus-forced-tail technique as Habits' completion history and Goals' progress cascades, so a book's own `currentPage` always lands exactly on the sum of its generated sessions' pages rather than being two independently-random numbers that happen to disagree (verified directly: zero mismatches across all 24 books).
- Full CRUD: create/edit/duplicate/delete/favorite/archive on books; status transitions (start reading, complete, pause, re-read) that correctly cascade `dateStarted`/`dateCompleted`/`currentPage` together rather than needing three separate edits; log/delete reading sessions; add/favorite/delete quotes; add/delete highlights (6 colors); add/pin/update/delete notes; toggle collection membership.
- Computed, never stored: progress %; a reading streak (current/longest — mirrors Habits' streak math, simpler since there's no due/skip concept, just "logged a session that day or didn't"); a monthly reading heatmap; a per-book reading-pace forecast; a 19-field dashboard stats block (books read, currently reading, wishlist, favorites, streaks, pages today/this-week/this-year, reading hours, sessions, average rating, completion rate, average book length, most-read genre/author, most productive month); genre/status breakdowns; a live per-book activity feed.
- Library page — header/toolbar/dashboard matching the established per-module shell exactly (`books-page`/`books-header`/`books-toolbar`, reusing the already-global `.toolbar-search`/`.toolbar-spacer`/`.header-summary`/`.menu--wide` rather than reinventing any of them), 8 dashboard stat cards (4 double as one-click filter shortcuts), a filter popover (status/genre/favorites/archived) and a 9-option sort popover, and the status-adaptive `BookCard` grid.
- Book Detail — full slide-in panel: status actions (Start reading / Mark completed / Pause / Re-read), an inline progress editor, the forecast widget, sessions/quotes/highlights/notes lists each with an inline add-form, interactive half-star rating + review block, collection toggles, linked Goals/Projects/Habits chips, scratch notes, and the activity feed.
- Insights aside — Currently Reading / Recently Completed / Recent Quotes preview lists, the reading heatmap, and a genre-breakdown bar chart, all real and clickable through to the book they reference.
- Real integrations: Calendar gained two new adapters (reading sessions, book target-finish deadlines) registered in the same `SOURCES` seam Habits/Goals/Projects already used — reading sessions are a genuinely different shape from the other three, surfacing only on days actually logged rather than recurring forward the way a habit reminder does, since a session is inherently a record of something that already happened. Dashboard's old static "Learning Progress" mock (a single hardcoded "Deep Work — Cal Newport" object that was really always standing in for whichever module got built first) is retired in favor of a live "Currently Reading" section reading real Books data, same retirement `habits[]`/`goals` got before it.

**Real bugs caught by validation, not hypothetical ones:**
- `StatCard`'s real prop is `title`, not `label` — all 8 dashboard stat cards in the first draft would have rendered with a blank title. Caught by grepping the actual component signature after the fact, not by trusting memory of it.
- The first draft of the Library page re-rendered the *entire* page — toolbar included — on every filter checkbox click, search keystroke, and card action. That would have silently discarded the filter popover's own open-state document listeners every time (`createPopover`'s `close()` never got called before its trigger/panel were replaced out from under it) and dropped keyboard focus out of the search input on every debounced keystroke. Restructured into a static shell (header/toolbar, rendered once per visit) plus a `#books-dynamic` region that's the only thing subsequent renders touch.
- A related but distinct case of the same bug class in Book Detail: the panel's document-level Escape/outside-click listeners captured the overlay element at attach time, and since `view.js` renders a brand-new `#book-detail-overlay` on every visit to the page, re-attaching naively on each visit would have stacked one more listener — each pointing at that visit's now-detached overlay — per visit. Fixed by guarding the attach to once per page load and looking the overlay/panel up fresh inside each handler instead of closing over a stale reference.
- Three invented CSS class names that matched nothing in any stylesheet (`.page-header`, `.toolbar__search`/`.toolbar__actions`, `.popover-panel`). The actual convention turned out to be per-module (`.goals-header`, `.goals-toolbar`) plus several classes that were already global (`.toolbar-search`, `.toolbar-spacer`, `.header-summary`, `.menu`/`.menu--wide`) and didn't need reinventing. Caught by scripting a check of every class token used in the module against every class actually defined anywhere in `css/`, not by inspection.
- `renderBooks` — the exact name `router.js` imports — was missing from the first draft of `view.js` entirely; only its internal helpers existed. Would have failed on the very first navigation to the page.
- A leftover placeholder in the grid card's action-menu handler ran a pointless dynamic `import('./state.js')` and did nothing with it — none of Edit/Duplicate/Favorite/Archive/Delete were actually wired to anything. Replaced with the real calls.
- Six Unicode emoji characters (in `Collection.icon` values and two review labels) that would have violated this milestone's own "no emoji icons" decision above — invisible to a normal read-through, since the JS source stores them as `\\u{...}` escape sequences that don't visually read as emoji in a diff. Caught by scripting a scan for the escape pattern itself.
- `MOOD_CONFIG.Neutral` referenced a `circle` icon that isn't one of the 50 defined in `icons.js` — would have silently rendered nothing. Swapped for `compass`.
- `.icon-btn--sm` and `.menu--inline` were referenced in six places with no corresponding CSS rule anywhere; defined both properly rather than stripping the classes back out.

---

## 2. Complete file tree

```
/index.html                     Landing page (hero demo, philosophy, 8 pillars, Launch Atlas CTA)
/app/index.html                 App shell: sidebar + topbar + command palette + view root
/.nojekyll                      Tells GitHub Pages not to run this through Jekyll
/README.md                      Structure, local-preview instructions, deploy steps
/docs/BUILD_LOG.md              This file

/assets/favicon.svg             Geometric "A" monogram, reused as the landing nav logo

/css/tokens.css                 Every design token: color (light+dark), type, spacing, radius, motion, elevation
/css/base.css                   Reset, focus states, skip link, reduced-motion override, scrollbar styling
/css/components.css             Shared atoms: buttons, badges, menus/dropdowns, avatar, empty state, progress bar, inputs
/css/app-shell.css              Sidebar, topbar, workspace switcher, command palette layout, responsive rules
/css/dashboard.css              Hero, StatCard, quick actions, 12-col grid, SectionCard, all 5 list-item types
/css/landing.css                Landing-page-only layout (hero, philosophy strip, pillar cards, footer)
/css/projects.css               Status/priority indicators, ring/percentage/milestone progress, cards, toolbar, detail panel
/css/habits.css                 Header/toolbar, 12-card stat grid, habit card + completion button states, weekly overview, heatmap, streak leaderboard, create/edit dialog
/css/goals.css                   Header/toolbar, 14-card stat grid, cover-gradient card grid, forecast pill/widget, detail panel (milestones/subtasks/linked entities/activity), create/edit dialog
/css/books.css                   Header/toolbar/dashboard (shared shell classes reused, not redefined), book cover gradients, status/genre badges, rating stars, quote/highlight/note cards, session rows, review block, dialog, detail panel
/* css/notes.css and css/calendar.css both exist and are loaded in app/index.html but predate this log's own record-keeping — not reconstructed here, see the note under "Current state" above. */

/js/icons.js                    Icon registry — one hand-built inline SVG per name, no external dependency
/js/store.js                    ~30-line observable store (theme, workspace, sidebar state) + localStorage
/js/theme.js                    Resolves light/dark/system, applies data-theme, reacts to system changes
/js/mock-data.js                User, workspaces, nav config, notifications, dashboard content (tasks/events/habits/notes/learning), quick actions
/js/popover.js                  One shared dropdown behavior, reused by workspace switcher / notifications / profile menu
/js/sidebar.js                  Nav rendering, mobile drawer, desktop collapse, workspace switcher logic
/js/topbar.js                   Date, page title, notifications dropdown, profile dropdown
/js/command-palette.js          ⌘K/Ctrl+K palette — real ARIA combobox pattern, arrow-key nav, unified search+actions
/js/components.js               Shared component library: Badge, Progress, emptyState, StatCard, SectionCard, QuickActionButton, TaskItem, EventItem, ProjectItem, NoteItem, HabitItem
/js/views.js                    Dashboard, Settings, and full-page empty-state renderers — assembled entirely from components.js
/js/router.js                   Hash router; dynamically imports the Projects module only when visited
/js/main.js                     App bootstrap — the one file that wires every module together
/js/landing.js                  Landing-page-only script: hero typewriter demo, philosophy/pillar rendering

/js/projects/data.js            Canonical project data — 14 projects, people roster, status/priority config
/js/projects/state.js           Pure filter/sort functions, page-local reactive state, date helpers, memoized selector
/js/projects/components.js      ProjectStatusBadge, ProjectPriority, ProjectProgress, ProjectDeadline, ProjectAvatarGroup, ProjectTag, ProjectEmptyState, ProjectSkeleton, ProjectActionMenu, ProjectHeader, ProjectCard
/js/projects/view.js             Page controller: toolbar, grid, detail panel — the only file in the module that touches the DOM

/* js/notes/*.js and js/calendar/*.js both exist (data.js/state.js/components.js/view.js each, plus calendar's month-view.js, agenda-view.js, mini-calendar.js, upcoming-panel.js, event-panel.js, repository.js) and are wired into router.js/sidebar.js — not reconstructed here, see the note under "Current state" above. */

/js/habits/data.js               Habit model (JSDoc typedefs), category/priority/frequency config, 11 mock habits, deterministic ~90-day generated completion history
/js/habits/state.js              Streak/stats/heatmap/weekly-overview math, search/filter/sort UI state + memoized selector, CRUD
/js/habits/components.js         CompletionButton, HabitCard, HabitActionMenu, CategoryHeader, StreakCard, WeeklyOverview, HeatmapGrid, skeleton/empty states
/js/habits/habit-dialog.js       Create/edit dialog — same modal shell pattern as calendar/event-panel.js, independent implementation
/js/habits/view.js               Page controller: header/toolbar, dashboard stat grid, category-grouped list, insights panel (weekly overview, heatmap, streak leaderboard)

/js/goals/data.js                Goal/Milestone/Subtask model, category/timeframe/status config, 16 mock goals with generated milestones/subtasks/progress-history
/js/goals/state.js               Progress cascade, forecast engine, dashboard stats, search/filter/sort, full CRUD (goals/milestones/subtasks)
/js/goals/components.js          GoalCard, GoalStatusBadge, GoalActionMenu, ForecastPill/Widget, GoalInsightCard, MilestoneRow, LinkedEntityChip, activity feed, skeleton/empty states
/js/goals/goal-dialog.js         Create/edit dialog — same modal shell pattern as habit-dialog.js
/js/goals/goal-detail.js         Immersive detail panel — same slide-in overlay mechanics as Projects' own detail panel, split into its own file given how much bigger this one is
/js/goals/view.js                Page controller: header/toolbar, dashboard stat grid, card grid, insights panel (upcoming deadlines, recently completed, activity)

/js/books/data.js                Book/ReadingSession/Quote/Highlight/BookNote/Collection model, status/genre/highlight-color/mood config, 24 mock books with generated sessions/quotes/highlights/notes
/js/books/state.js               Progress/streak/heatmap/forecast math, 19-field dashboard stats, search/filter/sort, full CRUD (books/sessions/quotes/highlights/notes/collections)
/js/books/components.js          BookCard, BookStatusBadge, BookActionMenu, RatingStars, GenreBadge, BookCover, Quote/Highlight/BookNoteCard, SessionRow, ReviewBlock, CollectionChip, BookActivityFeed, skeleton/empty states
/js/books/book-dialog.js         Create/edit dialog — same modal shell pattern as goal-dialog.js/habit-dialog.js
/js/books/book-detail.js         Slide-in detail panel — same overlay mechanics as goal-detail.js; status actions, progress editor, forecast, sessions/quotes/highlights/notes inline-add forms, review, collections, linked entities, activity
/js/books/view.js                Page controller: static header/toolbar shell (rendered once) + a separately-refreshed dashboard/grid/insights region — see §7 on why those two are split
```

---

## 3. Design tokens (`css/tokens.css`)

| Category | Values |
|---|---|
| Type | Inter (UI), JetBrains Mono (code/data), loaded via Google Fonts with `font-display:swap` |
| Type scale | 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40px (`--text-xs` → `--text-3xl`) |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px, named directly by pixel value |
| Radius | 6px inputs/buttons, 12px cards, 20px modals, plus a full-pill radius |
| Motion | 120ms micro, 200ms standard, 320ms panel — `cubic-bezier(0.16, 1, 0.3, 1)` easing throughout |
| Elevation | Two shadow tokens (`--shadow-float`, `--shadow-modal`); everything else uses 1px hairline borders, not shadows |

**Light theme:** bg `#FAFAF9`, bg-inset `#F2F1EE`, surface `#FFFFFF`, text `#14151A`, accent-solid `#3654E0`, success `#0F6B3D`, warning `#8A5210`, danger `#B02A2A`.

**Dark theme:** bg `#0B0C0F`, surface `#16181F`, text `#F5F5F3`, accent-text `#7C97FF` (lighter tint for contrast against near-black — accent-*solid* stays `#3654E0` in both themes since filled buttons need the same fill regardless of page theme; only the text/icon-on-background version needs to lighten).

**Added for the Projects module:** `--color-planning` (`#6D4FC4` light / `#A78BFA` dark), `--color-archived` (`#8A7B6C` light / `#B8AA9A` dark) — added only because nothing existing fit; everything else in the 7-status system reuses accent/success/warning/danger. Plus 7 project-*identity* colors (independent of status): blue `#3B82F6`, violet `#8B5CF6`, teal `#14B8A6`, amber `#F59E0B`, rose `#F43F5E`, emerald `#10B981`, slate `#64748B`.

**Added for the Books module:** `--identity-yellow` (`#EAB308`, same in both themes like the other 7 identities) — needed for the Highlights color palette (Yellow/Green/Blue/Pink/Purple/Orange); amber already reads as Orange, but none of the existing 7 identities was a true yellow. Every other Books color (statuses, genres, cover gradients) reuses the existing identity/semantic sets with zero further additions.

**Layout constants:** sidebar 260px expanded / 72px collapsed, topbar 64px tall.

---

## 4. Component library

### 4.1 — `js/components.js` (app-wide)
| Component | Props |
|---|---|
| `Badge` | `label`, `variant?` — auto-maps status words to a color if `variant` isn't given |
| `Progress` | `percentage`, `label?`, `color?` |
| `ProgressRing` | `percentage`, `label?`, `color?`, `size?`, `showValue?` — promoted out of Projects' own `ProjectProgress('ring')` once Habits needed the identical ring; Projects now delegates to this instead of keeping its own copy |
| `PriorityBadge` | `priority` — promoted out of Projects' own `ProjectPriority` once Goals needed the identical Low/Medium/High/Critical system; Projects now delegates to this |
| `DeadlineBadge` | `deadline` — promoted out of Projects' own `ProjectDeadline` once Goals needed the identical none/normal/soon/overdue proximity display; Projects now delegates to this |
| `HeatmapGrid` | `cells`, `monthLabel` — promoted out of Habits' own monthly heatmap once Books needed the identical GitHub-style grid; Habits now delegates to this. Cells can carry an optional pre-built `label`, added for Books' "45 pages read" phrasing — omitted, falls back to Habits' original "%(done/due)" format unchanged |
| `LinkedEntityChip` | `icon`, `title`, `meta?`, `color?` — promoted out of Goals' own cross-link chip once Books needed the identical thing for its own Goal/Project/Habit links; Goals now delegates to this |
| `ForecastPill` / `ForecastWidget` | both read a `forecast` object (`risk`, `likelyCompletionDate`, `confidence`, `velocityPerDay`, `requiredPacePerDay`) — promoted out of Goals' own forecast display once Books needed the identical shape for its reading-pace forecast; Goals now delegates to this. `ForecastWidget` gained an optional `velocityLabel`/`requiredPaceLabel` override so Books can show "pages/day" instead of Goals' original "%/day"; omitted, falls back to the exact original formatting unchanged |
| `emptyState` | `icon`, `title`, `description?`, `size?` ('sm' for in-card, default for full-page), `badge?` |
| `StatCard` | `title`, `value`, `icon`, `trend?`, `accent?` |
| `SectionCard` + `sectionAction` | `title`, `description?`, `action?`, `content` |
| `QuickActionButton` | `icon`, `label`, `id` |
| `TaskItem` | `id`, `title`, `category`, `priority?`, `dueTime?`, `done` |
| `EventItem` | `id`, `time`, `title`, `location?`, `color` |
| `ProjectItem` | `id`, `name`, `status`, `lastUpdated`, `progress?` — the dashboard's lightweight preview row, distinct from the Projects module's `ProjectCard` |
| `NoteItem` | `id`, `title`, `editedDate`, `tag?` |
| `HabitItem` | `id`, `name`, `icon?`, `streak`, `completedToday?`, `weeklyProgress?` — the dashboard's lightweight preview row; now fed live data from `js/habits`, no longer a static array |
| `GoalItem` | `id`, `title`, `deadline`, `progress?` — the dashboard's lightweight preview row; reuses `ProjectItem`'s own `.project-item` CSS directly since the shape is identical, rather than a duplicate class |

The header "label + bold number" strip (`.header-summary` / `.header-summary__item` in `components.css`) is the same kind of promotion, one level below a named component: it started as Habits-page-only markup, moved to a shared class once Goals' own header needed the identical thing.

`.menu__item--danger` was also added to `components.css` this milestone (a plain additive rule — a destructive item like Habits' "Delete" didn't have a styled option before; Projects/Calendar's own delete actions turned out to just use unstyled `.btn--secondary`, so this is a small net-new capability, not a fix).

### 4.2 — `js/projects/components.js` (Projects module)
`ProjectStatusBadge`, `ProjectPriority` (delegates to the shared `PriorityBadge`), `ProjectProgress` (4 variants: bar *reuses* the app-wide `Progress` directly rather than reimplementing it; ring delegates to the shared `ProgressRing`; percentage/milestone are Projects-only), `ProjectDeadline` (delegates to the shared `DeadlineBadge`), `ProjectAvatarGroup` (overlapping stack + overflow count), `ProjectTag` (clickable — filters the grid), `ProjectEmptyState`, `ProjectSkeleton`, `ProjectActionMenu` (favorite / pin / archive), `ProjectHeader` (reused by both the card and the detail panel), `ProjectCard`.

### 4.3 — `js/habits/components.js` (Habits module)
`CompletionButton` (5 states: incomplete/done/skipped/missed/locked — locked = not due this day per the habit's own schedule, so no actionable control is shown), `HabitCard`, `HabitActionMenu` (Edit/Duplicate/Favorite/Archive/Delete — a separate menu from the shared app-wide `ActionMenu`, since that one's Pin action doesn't apply to habits), `CategoryHeader` (collapsible; also satisfies the spec's separate "Habit Categories" ask — see §1.6), `StreakCard` (shared by both the Current and Longest leaderboards via a `kind` prop), `WeeklyOverview`, `HeatmapGrid` (delegates to the shared version — see §4.1), `HabitSkeleton`, `HabitsEmptyState`.

### 4.4 — `js/goals/components.js` (Goals module)
`GoalStatusBadge` (its own status vocabulary — Goals' 8 statuses and Projects' 7 only partly overlap, so this stayed separate rather than forcing a shared union type neither module wants), `GoalActionMenu` (same Edit/Duplicate/Favorite/Archive/Delete shape as Habits'), `ForecastPill` and `ForecastWidget` (both delegate to the shared versions — see §4.1) — both read the same `computeForecast()` output, `GoalInsightCard` (renders the rule-based insight — see §1.7 on why this isn't "AI"), `GoalCard`, `MilestoneRow` (renders its own subtask checklist inline), `LinkedEntityChip` (delegates to the shared version — see §4.1), `GoalActivityFeed`, `GoalSkeleton`, `GoalsEmptyState`.

### 4.5 — `js/books/components.js` (Books module)
`BookStatusBadge` (own status vocabulary, same reasoning as `GoalStatusBadge` — Books' Paused/Dropped/Re-reading don't line up with either existing status system), `BookActionMenu` (same Edit/Duplicate/Favorite/Archive/Delete shape as Habits'/Goals' — quick actions like "Continue reading"/"Mark complete" live in the detail panel instead of the card, the same choice Goals made for "Update progress"), `RatingStars` (0–5, 0.5 steps — no precedent elsewhere in the app; half-star via a gray base star + a colored copy clipped to a percentage width, stacked on top, rather than a second icon glyph), `GenreBadge` (dot + label, same visual language as Goals' own category chips), `BookCover` (identity-color gradient + the title's first letter — no real cover images, no emoji), `BookCard` (status-adaptive primary row — see the M1 decisions above), `QuoteCard`, `HighlightCard` (6 color variants), `BookNoteCard` (pin support), `SessionRow`, `ReviewBlock`, `CollectionChip`, `BookActivityFeed` (its own copy rather than a forced shared abstraction with `GoalActivityFeed` — the event-type vocabularies don't overlap enough to want a shared union type), `BookSkeleton`, `BooksEmptyState`. Reuses `ProgressRing`, `HeatmapGrid`, `LinkedEntityChip`, `ForecastPill`/`ForecastWidget`, `StatCard`, `SectionCard`, and `emptyState` directly from §4.1 rather than redefining any of them.

---

## 5. Data models

**`mock-data.js`:** `currentUser` (name/email/initials), `workspaces` (3: Personal/University/Startup), `navItems` (11: Dashboard, Projects, Calendar, Notes, Habits, Goals, Learning, Finance, Books, Coding, Settings — each with an optional roadmap `phase`), `notifications` (3), `dashboardData` (stats/tasks/events/notes — `habits` and `learning` both retired from here; the Dashboard now reads live from `js/habits` and `js/books` respectively), `quickActions` (4: Task/Note/Project/Event).

**`projects/data.js`:** 6-person roster (Alex Morgan, Sarah Chen, Jordan Lee, Priya Patel, Marcus Webb, Nina Ortiz), 7 statuses (Not Started, Planning, In Progress, Blocked, Review, Completed, Archived), 4 priorities (Low, Medium, High, Critical), 7 project-identity colors, and **14 projects**, each carrying: `id`, `title`, `description`, `icon` (emoji), `status`, `priority`, `deadline`, `estimatedCompletion`, `progress`, `owner`, `members[]`, `color`, `createdAt`, `updatedAt`, `lastActivity`, `tags[]`, `taskCount`, `completedTaskCount`, `attachmentsCount`, `notesCount`, `favorite`, `pinned`, `cover` (boolean — cover images are CSS gradients built from the project's own color via `color-mix()`, not external image files).

**Sort options (9, all real comparators):** Recently updated (default), Recently created, Newest, Oldest, Deadline, Alphabetical, Progress, Priority, Most active. (Note: "Newest" and "Recently created" are both `createdAt` descending — the spec listed them as two separate options, so both exist as labels even though they produce identical ordering.)

**Filters:** search text, status, priority, tags, favorites-only, show-archived (archived projects are hidden by default — a deliberate, stated default, not a silent one).

**`habits/data.js`:** 9 categories (Morning/Afternoon/Evening/Health/Learning/Fitness/Reading/Coding/Custom), 3 priorities (Low/Medium/High), 4 frequency types (daily/weekdays/weekends/custom-days), 7 identity colors (same set as Projects), and **11 habits**, each carrying: `id`, `title`, `description`, `category`, `icon`, `color`, `frequency`, `customDays[]` (only for 'custom'), `reminderTime` (nullable), `goal` (nullable `{targetValue, unit}`), `priority`, `tags[]`, `notes`, `favorite`, `archived`, `linkedProjectId` (nullable), `goalId` (nullable, unused — reserved for a future Goals module), `createdAt`, `updatedAt`. Completion history is a flat `{habitId, date, status}` list where `status` is only ever `'done'` or `'skipped'` — `'missed'` is never stored, it's inferred for any past due-date with no entry, same "don't store what's derivable" reasoning as everywhere else in this codebase.

**Sort options (8):** Current streak (default), Longest streak, Completion %, Alphabetical, Priority, Category, Newest, Recently updated. (Manual drag-order is not among them — see §8.)

**Filters:** search text, category, priority, favorites-only, status (active/archived/all — active is the default).

**`goals/data.js`:** 17 categories, 7 timeframes (Daily/Weekly/Monthly/Quarterly/Annual/Short-term/Long-term — a separate axis from category; see §1.7 on why), 8 statuses (Not Started/Planning/In Progress/Paused/Blocked/Completed/Cancelled/Archived), the shared 4-tier priority, and **16 goals**, each carrying: `id`, `title`, `description`, `icon` (emoji), `coverColor`, `category`, `timeframe`, `priority`, `status`, `createdAt`/`updatedAt`/`completedAt`, `deadline`/`startDate`, `favorite`, `archived`, `measurable` (nullable `{targetValue, unit, currentValue}`), `manualProgressOverride` (only used when a goal has neither a measurable target nor any milestones), `tags[]`, `notes`, `linkedProjectIds[]`/`linkedHabitIds[]`/`linkedNoteIds[]` (real cross-module ids), `milestones[]` (each with its own `subtasks[]`), `progressHistory[]` (generated time series, feeds the forecast engine), `activity[]` (a real append-only log, not re-derived).

**Progress is a cascade, computed live, never stored:** a measurable goal's `currentValue/targetValue`, else the average of its milestones' own progress (each milestone: subtasks-done-ratio if it has any, else a manual value), else `manualProgressOverride`.

**Forecast engine (`computeForecast`):** trailing 21-day velocity (progress-per-day), a likely completion date projected forward from it, a confidence score from how consistent that velocity has actually been (not a guess), and a risk level (low/medium/high) from comparing the pace the deadline requires against the pace actually being kept. Plain arithmetic, not machine learning — see §1.7 on why "AI Suggestions" became a rule-based Insights line instead.

**Sort options (9):** Deadline (default), Priority, Progress %, Risk, Confidence, Alphabetical, Newest, Oldest, Recently updated.

**Filters:** search (title fuzzy-matched, everything else plain substring), category, timeframe, priority, status, favorites-only, archived (hidden by default).

**`books/data.js`:** 7 statuses (Currently Reading/Want to Read/Completed/Paused/Dropped/Re-reading/Archived), 19 genres (the spec's own default list, each mapped to one of the 7 identity colors), 6 highlight colors (Yellow/Green/Blue/Pink/Purple/Orange — 5 reuse existing identities, Yellow needed the one new token, see §3), 5 session moods, and **24 books**, each carrying: `id`, `title`, `subtitle`, `author`, `coverColor`, `description`, `publisher`/`publicationYear`/`isbn`/`language`, `totalPages`, `genres[]`, `tags[]`, `status`, `rating` (nullable, 0–5 in 0.5 steps), `favorite`, `archived`, `dateAdded`/`dateStarted`/`dateCompleted`/`targetFinishDate` (nullable — the field added for the Calendar integration, see the M1 decisions above), `currentPage`, `lastOpened`, `review` (nullable, embedded — `text`/`pros`/`cons`/`wouldRecommend`/`favoriteQuote`), `linkedGoalIds[]`/`linkedProjectIds[]`/`linkedHabitIds[]` (real cross-module ids, same role as Goals' own linked-id arrays), `notes` (scratch text, same role as `Goal.notes` — distinct from the separate `BookNote` entities below), `createdAt`/`updatedAt`. Four child collections, each its own flat array keyed by `bookId` rather than nested on the book (session/quote/highlight/note counts are always computed by filtering these, never stored): **97 `ReadingSession`s** (`date`, `startTime`/`endTime`, `durationMinutes`, `startPage`/`endPage`, `mood`, `notes`), **16 `Quote`s** (`page`/`chapter`, `text`, `tags[]`, `favorite`), **31 `Highlight`s** (adds `color`, `note`), **14 `BookNote`s** (`title`, `text`, `pinned` — plain text this milestone, see §8 on the real Notes editor), plus **6 `Collection`s** (`name`, `icon` — an SVG icon name, not emoji, see the M1 decisions above — `coverColor`, `bookIds[]`).

**Sort options (9):** Recently opened (default), Date added, Title A–Z, Title Z–A, Author, Highest rated, Progress, Pages, Publication date.

**Filters:** search text (title/author/tags), status (multi-select), genre (multi-select), favorites-only, show-archived (archived hidden by default, same stated-not-silent default as Projects).

**Reading forecast (`computeReadingForecast`):** trailing velocity in pages/day from a book's own logged sessions (not a fixed window like Goals' 21 days — most books don't have that much history yet), a likely-finish date projected forward from it, a confidence score from session-to-session pace consistency, and a risk level that's only ever computed once a real `targetFinishDate` exists — `'unknown'` otherwise, the same "no deadline, no risk to measure against" rule Goals uses. Reading streak (`computeReadingStreak`) mirrors Habits' own streak math but simpler: a day counts if at least one session was logged that day, across every book — there's no per-item due/skip concept the way a single habit has one.

---

## 6. Accessibility

Skip-to-content link · `:focus-visible` rings everywhere (not `:focus`, so mouse users don't see rings on click) · global `prefers-reduced-motion` override that zeroes every animation/transition · real ARIA: `role="dialog" aria-modal="true"` on the command palette and the project detail panel, a genuine `combobox`/`listbox` pattern on the command palette (not a lookalike — `aria-expanded`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`), `role="checkbox" aria-checked` on the custom task/habit toggles, `aria-current="page"` on the active nav link, `aria-haspopup`/`aria-expanded` on every dropdown trigger · focus management: command palette and detail panel both save and restore focus on open/close; the mobile drawer moves focus to its first link on open and back to the hamburger on close · full keyboard support: Escape closes any open overlay, arrow keys navigate the command palette and sort menu, Enter/Space activate the custom checkbox controls.

**Habits adds:** the same `role="dialog" aria-modal="true"` + focus-trap + save/restore-focus pattern for its own create/edit dialog (independent implementation, same shell shape as the command palette/detail panel/event dialog). `CompletionButton` is `role="checkbox" aria-checked`, consistent with the existing task/habit toggle convention, and is genuinely `disabled` (not just visually dimmed) in its locked/missed states. Heatmap cells with real data are individually focusable (`tabindex="0"`) with a descriptive `aria-label` (date, percentage, count) doubling as the hover tooltip; empty/future/out-of-month cells are `aria-hidden`. A visually-hidden `aria-live="polite"` region announces the result of every completion click ("Morning Run marked complete — 12 day streak") for screen-reader users, since the visual checkmark-draw animation alone wouldn't reach them. The three deferred header buttons (Import/Export/Settings) are genuinely `disabled` with an explanatory `title`, not clickable-but-broken.

**Goals adds:** the same create/edit dialog focus-trap pattern once more (`goal-dialog.js`). The detail panel deliberately does *not* trap focus — same choice Projects' own detail panel already made, since a panel this dense with interactive rows (milestone checkboxes, subtask checkboxes, per-row menus) needs normal Tab flow through all of them rather than being boxed in; it still saves and restores focus on open/close. Milestone completion is `role="checkbox" aria-checked`. A subtle but real one: re-rendering the detail panel after an interaction (checking a subtask, completing a milestone) deliberately does *not* re-focus anything, specifically so checking off several subtasks in a row doesn't get your keyboard focus yanked back to the close button after every single click (see the bug note in §1.7 — this was originally broken, then fixed).

**Books adds:** the same dialog focus-trap and detail-panel save/restore-focus pattern once more (`book-dialog.js`/`book-detail.js`), and the same deliberate no-refocus-on-interaction fix Goals needed — logging a session or adding a quote inside an open panel doesn't yank focus back to the close button either, applied correctly from the start this time rather than needing the same bug caught twice. Interactive `RatingStars` is a `role="radiogroup"` of half/full-star hit targets, each with its own `aria-label` ("Rate 4.5 stars") rather than relying on a bare number being self-explanatory. Reading-heatmap cells follow the exact same focusable/`aria-label`/`aria-hidden` split Habits' heatmap established, through the same shared `HeatmapGrid` component — nothing module-specific needed re-deciding here.

---

## 7. Validation methodology (used at the end of every milestone)

Every JS file syntax-checked as a real ES module (`node --check` via stdin, not just as a script). Every `import { x }` cross-referenced against the actual `export` list of its target file, including path resolution across subfolders. Every dynamic `import()` target confirmed to exist. Every `getElementById` call cross-referenced against every id that exists anywhere — including ids that JS itself generates via template strings, not just the two static HTML files. Every CSS class used in JS cross-referenced against actual CSS rules. Every `var(--x)` used anywhere cross-referenced against `tokens.css` definitions. Both HTML files parsed for tag balance. **Added this milestone:** for modules with real computed logic (streaks, stats, heatmap math), the data/state layer is actually executed in Node against the real mock data — not just statically checked — since wiring mistakes and wrong math are different failure classes and static analysis alone only catches the first one.

**Real bugs this caught, not hypothetical ones:** a dead `--space-20` CSS fallback, a missing `.quick-action__label` rule, a missing `.badge--planning`/`.badge--archived` pair, a stale-cache bug where archiving a project while "show archived" was off wouldn't have actually removed it from the grid, a body-scroll-lock in the new habit dialog that referenced a CSS class (`overlay-open`) that didn't exist anywhere (the established pattern is a direct `style.overflow` toggle — fixed to match it), and seven missing per-color icon-chip classes for the weekly-overview day-detail popover.

**Added again this milestone, for Books specifically:** the CSS-class cross-check became a scripted pass over every module's files rather than case-by-case inspection — every static class token used in `js/books/*.js` diffed against every class actually defined anywhere in `css/`, which is what caught the three invented toolbar/header class names in §1.8 (inspection alone had already missed them once). Every `icon('name')` call (literal and the handful of dynamic ones) was cross-checked against the real, complete list of icon keys in `icons.js` rather than assumed from memory, which is what caught the nonexistent `circle` icon. A full CRUD round-trip (create → every mutation → duplicate → delete, across books/sessions/quotes/highlights/notes/collections) was executed in Node end to end, not just individual functions in isolation, to catch cascade mistakes (a status change not updating `dateStarted`, a session not bumping `currentPage`) that unit-style checks of one function at a time wouldn't surface. And because this milestone had an explicit "no emoji icons" constraint, a dedicated script scanned every new file for the `\u{...}`-style escape sequences emoji get stored as in JS source — genuinely different from reading the file, since an escape sequence doesn't visually read as an emoji in a diff the way the character itself would.

---

## 8. What's deliberately deferred (and why)

- **List and Kanban views + drag-and-drop.** The toolbar's view-switcher shows them as `disabled` with a tooltip, not clickable-but-broken. Kanban specifically still needs a decision about where Not Started/Blocked/Archived projects live, since the brief's 4 Kanban columns (Planning/In Progress/Review/Done) don't cover all 7 statuses.
- **Actually creating or editing a project** (`ProjectModal`/`ProjectForm`). No backend exists to persist one, so "New Project" opens the command palette instead of a fake or dead button.
- **Import/Export.** Needs real file I/O; not stubbed.
- **Deadline-range, completion%, owner, member, and color filters.** Status/priority/tags/favorites/archived are built; these five are not yet.
- **Keyboard shortcuts and right-click context menus specific to Projects.**

**Habits:**
- **The Achievements/badge-unlock system.** Cuts against the landing page's own "without a gamified layer" positioning for this feature — see §1.6. Worth a real product decision before building, not a default yes.
- **History/Timeline view with infinite scroll.** The heatmap and weekly overview cover recent activity; a full chronological log across all habits is a bigger, separate piece of scope, and true list virtualization is only worth building once that view exists.
- **A second in-module calendar (`CalendarView`).** Would duplicate the real Calendar module — see §1.6. Habit reminders/schedules already appear on the real Calendar via `repository.js`.
- **Manual drag-to-reorder.** Same reasoning as Projects deferring drag-and-drop for its views — not among the 8 sort options this milestone.
- **Import/Export and a dedicated Habit Settings surface.** Same as Projects' Import/Export (§8 above) — needs real file I/O / a settings architecture that doesn't exist yet. The three header buttons exist and are visibly `disabled` rather than omitted or faked.
- **A styled delete-confirmation dialog.** Uses the browser's native `confirm()` for now — functional, just not custom-styled; the rest of the app has no existing modal-confirmation pattern to match against.

**Goals:**
- **Timeline/Roadmap view.** The single biggest deferral this milestone — a real zoomable (week/month/quarter/year), dependency-aware roadmap is substantial standalone scope, the same category of decision as Calendar deferring Week/Day views. Grid shipped; this didn't.
- **List view.** Same reasoning Projects gave for deferring its own List view (§8 above).
- **Milestone dependencies and nested sub-milestones.** Real added complexity (cycle detection, a dependency-aware UI) beyond what a first milestone needs; flat milestones with subtasks cover the core value.
- **Comments.** Doesn't have a coherent meaning in a single-user app with no auth/identity system — who would be commenting?
- **Share / Export / Print.** Same "needs real file I/O" reasoning as Projects'/Habits' Import/Export deferrals.
- **Drag-to-reorder** for milestones/subtasks — consistent with Projects/Habits both deferring drag-and-drop.
- **Learning and Finance integrations.** Neither module exists yet — see §1.7.

**Books:**
- **Standalone Author and Collection management pages.** Same "no real system to back it" reasoning as everywhere else in this section — no file storage for author photos, and Collections already has real data plus a working add/remove toggle from Book Detail; a dedicated management surface (rename, reorder, create new from scratch) is a genuinely separate, smaller piece of scope on top of that.
- **Global Quotes/Highlights/Notes browsing pages.** The spec's own Search section lists these as independently searchable; this milestone scopes them to inside each book's own Detail panel instead. A cross-book "all my highlights" view is real, deferred scope, not a redesign of what's already built.
- **The full rich-text/Markdown Notes editor for `BookNote`.** Plain text this milestone (see §5) — reusing the real Notes module's actual editor (`js/notes/editor.js`) is the honest longer-term answer, not a bespoke second rich-text implementation; swapping it in doesn't touch `BookNote`'s own data shape.
- **ISBN/cover-image lookup.** No external API exists to call, same reasoning as every other module's Import/Export deferrals — this one's just a lookup instead of a file.
- **Achievement badges / reading challenges.** Same "cuts against the landing page's own no-gamification positioning" reasoning Habits gave for deferring its own Achievements system in §1.6 — worth a real product decision, not a default yes.
- **Radar charts, calendar-style (as opposed to GitHub-style) heatmaps, and the rest of the spec's longer chart list.** One real, working heatmap (reused from Habits) and the genre-breakdown bar chart shipped; the spec's other five-plus chart types are a distinct piece of scope, not a placeholder gap in what's here.
- **List/alternate views for the Library grid, and drag-to-reorder.** Consistent with every other module deferring the same two things this build has already established (§8 above).
- **Import/Export.** Same as every other module — needs real file I/O.
- **AI Assistant, Learning-path, and Notifications integrations.** None of those three systems exist yet, so there's nothing real to wire into — same reasoning Goals gave for its own Learning/Finance deferrals just above.

---

## 9. Known limitations

- Everything is in-memory. Reloading the page resets task/habit checkbox toggles, Habits' own completion/CRUD changes, and any Projects-module edits (favorite/pin/archive) back to the seed data — only theme, workspace selection, and sidebar-collapsed state persist, via `localStorage`.
- ES module scripts don't execute over `file://` in Chrome (a browser restriction, not a bug here) — local preview needs `python3 -m http.server`, not double-clicking the file. Doesn't affect GitHub Pages, which serves over real HTTPS.
- Dashboard, Projects, Notes, Calendar, Habits, Goals, and now Books are all real pages backed by live data. Learning and Finance are still the honest empty-state placeholders from the very first milestone, each tagged with its roadmap phase where one exists.
- The dashboard's own habit-completion toggle is a simple binary (done / not done) — the richer 3-state cycle (done/skipped/undo) only exists on the Habits page itself. A deliberate scope difference for a small preview widget, not an inconsistency to fix later without also redesigning `HabitItem`'s markup.
- Habits' 90-day completion history is generated at page-load time relative to the real current date (see §1.6), not stored — reloading regenerates the same shape (same seeds) but "today" shifts forward with it, so streak numbers will very gradually change build-to-build as real time passes, which is intended, not a bug.
- Goals' progress-history and milestone deadlines are generated the same way, for the same reason — coherent whenever the app is opened rather than a fixed snapshot from whenever it was authored. Same consequence: the forecast engine's numbers will drift slightly, on purpose, as real time passes between visits.
- The forecast engine is a simple, real velocity/consistency model — not machine learning, and not branded as "AI" anywhere in the UI (see §1.7). It's a genuine computation over real generated history, not a placeholder number, but it's also not the kind of analysis the spec's "AI Suggestions" language might imply.
- Books' reading sessions are generated the same relative-to-today way as Habits'/Goals' own histories, for the same reason and with the same consequence — the reading streak, heatmap, and forecast will all drift slightly, on purpose, as real time passes between visits. A book's `currentPage` is deliberately kept in exact sync with the sum of its own generated sessions (verified during validation, see §7) rather than being two independently-generated numbers that happen to roughly agree.
- Books' Calendar integration (reading-session events, target-finish deadlines) inherits the same in-memory-only limitation as everything else in §9's first bullet — logging a real session from the Books page will show up on the Calendar for the rest of that session, but neither survives a reload.
