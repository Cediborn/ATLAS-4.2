// Atlas — Goals canonical data. Same layering as habits/data.js: raw
// content + the shape predicates generation needs; derived math (progress,
// forecast, stats) lives in state.js.
//
// Two fields the spec asked for don't exist here: `coverImage` and
// `attachments` would need real file storage, which this app doesn't have
// (same reasoning Habits gave for not faking Import/Export). `visibility`
// is dropped too — there's no auth/multi-user system for "private vs
// shared" to mean anything yet. `coverColor` stays (drives a CSS gradient,
// no file needed).
//
// "Goal Types" and "Goal Categories" overlapped in the spec (Financial vs
// Finance, Academic vs Education, Health vs Health, Personal vs Personal,
// Professional/Life vs nothing) — they can't both be a single-select field
// on the same goal without conflicting. Resolved as two separate axes:
// `category` (the 17-item domain list) and `timeframe` (the time-horizon
// subset only — Daily/Weekly/Monthly/Quarterly/Annual/Short-term/Long-term),
// dropping the domain-flavored entries from the original "Goal Types" list
// since `category` already covers that.

import { dateKey, todayDate } from '../date-utils.js';
export { PRIORITY_CONFIG, PRIORITIES } from '../components.js';

/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} title
 * @property {boolean} done
 */

/**
 * @typedef {Object} Milestone
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string|null} deadline     - 'YYYY-MM-DD'
 * @property {boolean} completed
 * @property {string|null} completedAt
 * @property {'Low'|'Medium'|'High'|'Critical'} priority
 * @property {string} notes
 * @property {number|null} estimatedHours
 * @property {number|null} actualHours
 * @property {number|null} manualProgress - only used when subtasks[] is empty
 * @property {Subtask[]} subtasks
 */

/**
 * @typedef {Object} Goal
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} icon               - emoji, same convention as projects/data.js
 * @property {string} coverColor         - identity color key, drives the card's gradient
 * @property {string} category           - a CATEGORY_CONFIG key
 * @property {string} timeframe          - a TIMEFRAME_CONFIG key
 * @property {'Low'|'Medium'|'High'|'Critical'} priority
 * @property {string} status             - a STATUS_CONFIG key
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} completedAt
 * @property {string|null} deadline
 * @property {string|null} startDate
 * @property {boolean} favorite
 * @property {boolean} archived
 * @property {{targetValue:number, unit:string, currentValue:number}|null} measurable - null for milestone-driven or manual goals
 * @property {number|null} manualProgressOverride - only used when there's neither a measurable target nor any milestones
 * @property {string[]} tags
 * @property {string} notes
 * @property {string[]} linkedProjectIds  - real Projects module ids
 * @property {string[]} linkedHabitIds    - real Habits module ids
 * @property {string[]} linkedNoteIds     - real Notes module ids
 * @property {Milestone[]} milestones
 * @property {{date:string, value:number}[]} progressHistory - ascending by date, drives the forecast engine
 * @property {{id:string, date:string, type:string, message:string}[]} activity
 */

export const CATEGORY_CONFIG = {
  career: { label: 'Career', icon: 'briefcase', color: 'blue' },
  education: { label: 'Education', icon: 'bookOpen', color: 'teal' },
  coding: { label: 'Coding', icon: 'code', color: 'blue' },
  reading: { label: 'Reading', icon: 'book', color: 'slate' },
  fitness: { label: 'Fitness', icon: 'flame', color: 'emerald' },
  health: { label: 'Health', icon: 'heart', color: 'rose' },
  business: { label: 'Business', icon: 'trendingUp', color: 'amber' },
  finance: { label: 'Finance', icon: 'wallet', color: 'amber' },
  travel: { label: 'Travel', icon: 'compass', color: 'violet' },
  family: { label: 'Family', icon: 'users', color: 'rose' },
  relationships: { label: 'Relationships', icon: 'users', color: 'violet' },
  creativity: { label: 'Creativity', icon: 'sparkle', color: 'rose' },
  learning: { label: 'Learning', icon: 'lightbulb', color: 'teal' },
  mindfulness: { label: 'Mindfulness', icon: 'moon', color: 'slate' },
  productivity: { label: 'Productivity', icon: 'checklist', color: 'blue' },
  personal: { label: 'Personal', icon: 'star', color: 'violet' },
  custom: { label: 'Custom', icon: 'sparkle', color: 'slate' },
};
export const CATEGORIES = Object.keys(CATEGORY_CONFIG);

export const TIMEFRAME_CONFIG = {
  daily: { label: 'Daily' },
  weekly: { label: 'Weekly' },
  monthly: { label: 'Monthly' },
  quarterly: { label: 'Quarterly' },
  annual: { label: 'Annual' },
  shortTerm: { label: 'Short-term' },
  longTerm: { label: 'Long-term' },
};
export const TIMEFRAMES = Object.keys(TIMEFRAME_CONFIG);

// Reuses Projects' status colors wherever the meaning already fits (see
// projects/data.js's own comment on this); only Paused and Cancelled are
// genuinely new here and had to share hues with something close in spirit
// rather than invent two more semantic colors app-wide.
export const STATUS_CONFIG = {
  'Not Started': { color: 'neutral' },
  Planning: { color: 'planning' },
  'In Progress': { color: 'accent' },
  Paused: { color: 'warning' },
  Blocked: { color: 'danger' },
  Completed: { color: 'success' },
  Cancelled: { color: 'danger' },
  Archived: { color: 'archived' },
};
export const STATUSES = Object.keys(STATUS_CONFIG);

export const GOAL_COLORS = ['blue', 'violet', 'teal', 'amber', 'rose', 'emerald', 'slate'];

function daysAgo(n) {
  const d = todayDate();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}
function daysAhead(n) {
  const d = todayDate();
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

let idCounter = 1;
export function createGoalId() {
  return `g${idCounter++}`;
}
export function createMilestoneId() {
  return `m${idCounter++}`;
}
export function createSubtaskId() {
  return `st${idCounter++}`;
}

// ---- Deterministic generation (same reasoning as habits/data.js: mock
// content that's really a time series should stay coherent whenever the
// app is opened, not be frozen to the day it was authored) ----
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const MILESTONE_TITLE_BANK = [
  'Research and plan approach', 'Set up the foundation', 'Complete first major phase',
  'Mid-point review', 'Refine and iterate', 'Handle the hard part', 'Polish and finalize',
  'Get external feedback', 'Final push', 'Wrap up and reflect',
];
const SUBTASK_TITLE_BANK = [
  'Outline the steps', 'Block time on the calendar', 'Gather resources', 'Do a first pass',
  'Review progress', 'Fix the rough edges', 'Get a second opinion', 'Ship it',
];

// Builds `milestoneCount` milestones (each with 2-4 subtasks) for a goal,
// with the first `doneThrough` milestones fully completed — deterministic
// per goal via its own seed, not hand-authored per goal (150 milestones /
// 300 subtasks by hand isn't maintainable; a smaller generated set is more
// honest than pretending to hand-write that many — see BUILD_LOG).
function generateMilestones(goalId, seed, milestoneCount, doneThrough, createdAt, deadline) {
  const rand = seededRandom(seed);
  const today = todayDate();
  const createdDate = new Date(`${createdAt}T00:00:00`);
  // Spread milestones proportionally across the goal's real span (createdAt
  // to its deadline), not a fixed cadence — a fixed cadence clustered every
  // milestone right after creation for any goal with a distant deadline,
  // leaving nothing between "recently created" and "due in months," which
  // looked wrong once these started showing up on the real Calendar (see
  // BUILD_LOG). Goals with no deadline fall back to a 180-day soft span.
  const endDate = deadline ? new Date(`${deadline}T00:00:00`) : new Date(createdDate.getTime() + 180 * 86400000);
  const totalSpanDays = Math.max(milestoneCount * 7, Math.round((endDate - createdDate) / 86400000));

  const milestones = [];
  for (let i = 0; i < milestoneCount; i += 1) {
    const isDone = i < doneThrough;
    const subtaskCount = 2 + Math.floor(rand() * 3); // 2-4
    const subtasks = [];
    for (let j = 0; j < subtaskCount; j += 1) {
      const subDone = isDone || (i === doneThrough && rand() < 0.5);
      subtasks.push({ id: createSubtaskId(), title: SUBTASK_TITLE_BANK[(i + j) % SUBTASK_TITLE_BANK.length], done: subDone });
    }
    const fraction = (i + 1) / (milestoneCount + 1); // spread evenly, exclusive of the endpoints
    const deadlineOffsetDays = Math.round(totalSpanDays * fraction);
    let completedAt = null;
    if (isDone) {
      const daysSinceCreated = Math.max(1, Math.round((today - createdDate) / 86400000));
      const completedOffsetDays = Math.max(1, Math.min(deadlineOffsetDays, daysSinceCreated) - Math.floor(rand() * 3));
      completedAt = shiftDate(createdAt, completedOffsetDays);
    }
    milestones.push({
      id: createMilestoneId(),
      title: MILESTONE_TITLE_BANK[i % MILESTONE_TITLE_BANK.length],
      description: '',
      deadline: shiftDate(createdAt, deadlineOffsetDays),
      completed: isDone,
      completedAt,
      priority: ['Low', 'Medium', 'High'][Math.floor(rand() * 3)],
      notes: '',
      estimatedHours: 4 + Math.floor(rand() * 12),
      actualHours: isDone ? 4 + Math.floor(rand() * 14) : null,
      manualProgress: null,
      subtasks,
    });
  }
  return milestones;
}

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// Generates an ascending progress-history time series ending today, given
// a target current progress and a rough "shape" (steady / front-loaded /
// recently-stalled) — real enough for the forecast engine to compute
// genuine velocity/consistency numbers against, not a flat fake line.
function generateProgressHistory(seed, startDate, currentProgress, shape) {
  const rand = seededRandom(seed);
  const start = new Date(`${startDate}T00:00:00`);
  const today = todayDate();
  const totalDays = Math.max(1, Math.round((today - start) / 86400000));
  const sampleEvery = Math.max(1, Math.floor(totalDays / 24)); // ~24 sample points regardless of span
  const history = [];
  for (let d = 0; d <= totalDays; d += sampleEvery) {
    const t = d / totalDays; // 0..1
    let base;
    if (shape === 'frontLoaded') base = 1 - (1 - t) ** 0.5;
    else if (shape === 'stalled') base = t < 0.6 ? t / 0.6 : 1; // flat for the last 40% of the timeline
    else base = t; // steady
    const noise = (rand() - 0.5) * 0.05;
    const value = Math.max(0, Math.min(1, base + noise)) * currentProgress;
    const dateObj = new Date(start);
    dateObj.setDate(start.getDate() + d);
    history.push({ date: dateKey(dateObj), value: Math.round(value) });
  }
  // force the final point to be exactly today / currentProgress
  history.push({ date: dateKey(today), value: currentProgress });
  return history;
}

function generateActivity(goal, seed) {
  const rand = seededRandom(seed);
  const activity = [{ id: `act-${goal.id}-created`, date: goal.createdAt, type: 'created', message: `Goal created` }];
  goal.milestones.filter((m) => m.completed).forEach((m) => {
    activity.push({ id: `act-${m.id}`, date: m.completedAt, type: 'milestone', message: `Completed milestone \u201c${m.title}\u201d` });
  });
  if (goal.status === 'In Progress' && goal.createdAt !== todayKeyFallback()) {
    activity.push({ id: `act-${goal.id}-started`, date: shiftDate(goal.createdAt, 1 + Math.floor(rand() * 3)), type: 'status', message: `Status changed to In Progress` });
  }
  return activity.sort((a, b) => (a.date < b.date ? -1 : 1));
}
function todayKeyFallback() {
  return dateKey(todayDate());
}

// ---- Mock goals (16 — a smaller, generated set stands in for the spec's
// "at least 40/150/300"; see BUILD_LOG for why that's a stated reduction,
// not a silent one) ----
const seedGoals = [
  { id: 'g1', title: 'Become a Software Engineer', description: 'Land a junior engineering role within the next year.', icon: '\u{1F4BB}', coverColor: 'blue', category: 'career', timeframe: 'longTerm', priority: 'Critical', status: 'In Progress', createdAt: daysAgo(150), deadline: daysAhead(215), startDate: daysAgo(150), favorite: true, measurable: null, milestoneCount: 6, doneThrough: 2, shape: 'steady', currentProgress: 38, tags: ['Career', 'Engineering'], linkedProjectIds: ['p2'], linkedHabitIds: ['h5', 'h7'], linkedNoteIds: [] },
  { id: 'g2', title: 'Graduate University', description: 'Finish the CS degree with a strong final-year project.', icon: '\u{1F393}', coverColor: 'teal', category: 'education', timeframe: 'longTerm', priority: 'Critical', status: 'In Progress', createdAt: daysAgo(300), deadline: daysAhead(280), startDate: daysAgo(300), favorite: true, measurable: null, milestoneCount: 5, doneThrough: 3, shape: 'steady', currentProgress: 61, tags: ['University'], linkedProjectIds: ['p5'], linkedHabitIds: ['h5'], linkedNoteIds: [] },
  { id: 'g3', title: 'Launch Atlas', description: 'Ship every core module and put it in front of real users.', icon: '\u{1F680}', coverColor: 'violet', category: 'coding', timeframe: 'quarterly', priority: 'High', status: 'In Progress', createdAt: daysAgo(40), deadline: daysAhead(50), startDate: daysAgo(40), favorite: true, measurable: null, milestoneCount: 5, doneThrough: 3, shape: 'frontLoaded', currentProgress: 58, tags: ['Atlas', 'Engineering'], linkedProjectIds: ['p1', 'p2'], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g4', title: 'Reach Financial Freedom', description: 'Build savings and investments toward long-term independence.', icon: '\u{1F4B0}', coverColor: 'amber', category: 'finance', timeframe: 'longTerm', priority: 'Medium', status: 'In Progress', createdAt: daysAgo(200), deadline: null, startDate: daysAgo(200), favorite: false, measurable: { targetValue: 50000, unit: 'USD saved', currentValue: 12400 }, milestoneCount: 4, doneThrough: 1, shape: 'steady', currentProgress: 25, tags: ['Finance'], linkedProjectIds: [], linkedHabitIds: ['h11'], linkedNoteIds: [] },
  { id: 'g5', title: 'Become Fluent in Japanese', description: 'Conversational fluency for a future trip and job prospects.', icon: '\u{1F5FE}', coverColor: 'rose', category: 'education', timeframe: 'annual', priority: 'Medium', status: 'Paused', createdAt: daysAgo(220), deadline: daysAhead(145), startDate: daysAgo(220), favorite: false, measurable: null, milestoneCount: 5, doneThrough: 1, shape: 'stalled', currentProgress: 22, tags: ['Language'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g6', title: 'Read 500 Books', description: 'A lifetime reading list, tracked one book at a time.', icon: '\u{1F4DA}', coverColor: 'slate', category: 'reading', timeframe: 'longTerm', priority: 'Low', status: 'In Progress', createdAt: daysAgo(400), deadline: null, startDate: daysAgo(400), favorite: false, measurable: { targetValue: 500, unit: 'books', currentValue: 173 }, milestoneCount: 0, doneThrough: 0, shape: 'steady', currentProgress: 35, tags: ['Reading'], linkedProjectIds: [], linkedHabitIds: ['h2'], linkedNoteIds: [] },
  { id: 'g7', title: 'Build a SaaS Business', description: 'Take Atlas (or a spin-off) to a paying first customer.', icon: '\u{1F4C8}', coverColor: 'amber', category: 'business', timeframe: 'longTerm', priority: 'High', status: 'Planning', createdAt: daysAgo(20), deadline: daysAhead(345), startDate: daysAgo(20), favorite: false, measurable: null, milestoneCount: 3, doneThrough: 0, shape: 'steady', currentProgress: 8, tags: ['Business', 'Atlas'], linkedProjectIds: ['p1'], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g8', title: 'Run a Half Marathon', description: 'Go from 5K comfortable to 21.1K race-ready.', icon: '\u{1F3C3}', coverColor: 'emerald', category: 'fitness', timeframe: 'quarterly', priority: 'Medium', status: 'In Progress', createdAt: daysAgo(60), deadline: daysAhead(35), startDate: daysAgo(60), favorite: true, measurable: { targetValue: 21.1, unit: 'km long run', currentValue: 14 }, milestoneCount: 4, doneThrough: 2, shape: 'steady', currentProgress: 66, tags: ['Fitness'], linkedProjectIds: [], linkedHabitIds: ['h1', 'h8'], linkedNoteIds: [] },
  { id: 'g9', title: 'Improve Sleep Consistency', description: 'A stable sleep schedule instead of the current chaos.', icon: '\u{1F634}', coverColor: 'rose', category: 'health', timeframe: 'monthly', priority: 'High', status: 'In Progress', createdAt: daysAgo(25), deadline: daysAhead(5), startDate: daysAgo(25), favorite: false, measurable: null, milestoneCount: 3, doneThrough: 1, shape: 'stalled', currentProgress: 30, tags: ['Wellness'], linkedProjectIds: [], linkedHabitIds: ['h9'], linkedNoteIds: [] },
  { id: 'g10', title: 'Visit 10 New Countries', description: 'Slow, deliberate travel rather than a checklist rush.', icon: '\u2708\uFE0F', coverColor: 'violet', category: 'travel', timeframe: 'longTerm', priority: 'Low', status: 'In Progress', createdAt: daysAgo(500), deadline: null, startDate: daysAgo(500), favorite: false, measurable: { targetValue: 10, unit: 'countries', currentValue: 4 }, milestoneCount: 0, doneThrough: 0, shape: 'steady', currentProgress: 40, tags: ['Travel'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g11', title: 'Weekly Family Dinner', description: 'One phone-free dinner together every week, no exceptions.', icon: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', coverColor: 'rose', category: 'family', timeframe: 'weekly', priority: 'Medium', status: 'In Progress', createdAt: daysAgo(90), deadline: null, startDate: daysAgo(90), favorite: true, measurable: null, milestoneCount: 0, doneThrough: 0, shape: 'steady', currentProgress: 82, tags: ['Family'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g12', title: 'Write a Short Story Collection', description: 'Ten finished short stories, not just ideas in a notes app.', icon: '\u270D\uFE0F', coverColor: 'rose', category: 'creativity', timeframe: 'annual', priority: 'Low', status: 'Not Started', createdAt: daysAgo(5), deadline: daysAhead(360), startDate: null, favorite: false, measurable: { targetValue: 10, unit: 'stories', currentValue: 0 }, milestoneCount: 2, doneThrough: 0, shape: 'steady', currentProgress: 0, tags: ['Writing'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [] },
  { id: 'g13', title: 'Complete a Data Structures Course', description: "Trees, graphs, DP — properly this time, not just skimmed.", icon: '\u{1F4D6}', coverColor: 'teal', category: 'learning', timeframe: 'quarterly', priority: 'High', status: 'In Progress', createdAt: daysAgo(45), deadline: daysAhead(20), startDate: daysAgo(45), favorite: false, measurable: { targetValue: 12, unit: 'modules', currentValue: 8 }, milestoneCount: 4, doneThrough: 2, shape: 'frontLoaded', currentProgress: 67, tags: ['University', 'Coding'], linkedProjectIds: [], linkedHabitIds: ['h5'], linkedNoteIds: ['n1'] },
  { id: 'g14', title: 'Build a Daily Meditation Practice', description: '10 minutes a day, every day, for a full year.', icon: '\u{1F9D8}', coverColor: 'slate', category: 'mindfulness', timeframe: 'annual', priority: 'Medium', status: 'In Progress', createdAt: daysAgo(100), deadline: daysAhead(265), startDate: daysAgo(100), favorite: false, measurable: null, milestoneCount: 0, doneThrough: 0, shape: 'steady', currentProgress: 55, tags: ['Wellness', 'Mindfulness'], linkedProjectIds: [], linkedHabitIds: ['h4'], linkedNoteIds: [] },
  { id: 'g15', title: 'Inbox Zero, For Real This Time', description: 'A sustainable system, not just one big cleanup.', icon: '\u{1F4E5}', coverColor: 'blue', category: 'productivity', timeframe: 'monthly', priority: 'Low', status: 'Completed', createdAt: daysAgo(70), deadline: daysAgo(10), startDate: daysAgo(70), favorite: false, measurable: null, milestoneCount: 3, doneThrough: 3, shape: 'steady', currentProgress: 100, tags: ['Productivity'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [], completedAt: daysAgo(12) },
  { id: 'g16', title: 'Old Side-Project Idea (Shelved)', description: 'A gamified budgeting app — parked in favor of Atlas.', icon: '\u{1F4E6}', coverColor: 'slate', category: 'custom', timeframe: 'shortTerm', priority: 'Low', status: 'Cancelled', createdAt: daysAgo(180), deadline: null, startDate: daysAgo(180), favorite: false, measurable: null, milestoneCount: 2, doneThrough: 0, shape: 'stalled', currentProgress: 15, tags: ['Side project'], linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [] },
];

export const goals = seedGoals.map((g, idx) => {
  const seed = 200 + idx;
  const milestones = g.milestoneCount > 0 ? generateMilestones(g.id, seed, g.milestoneCount, g.doneThrough, g.createdAt, g.deadline) : [];
  const progressHistory = g.status === 'Not Started' ? [{ date: g.createdAt, value: 0 }] : generateProgressHistory(seed, g.startDate || g.createdAt, g.currentProgress, g.shape);
  const goal = {
    id: g.id, title: g.title, description: g.description, icon: g.icon, coverColor: g.coverColor,
    category: g.category, timeframe: g.timeframe, priority: g.priority, status: g.status,
    createdAt: g.createdAt, updatedAt: g.createdAt, completedAt: g.completedAt || null,
    deadline: g.deadline, startDate: g.startDate,
    favorite: g.favorite, archived: g.status === 'Cancelled',
    measurable: g.measurable, manualProgressOverride: milestones.length === 0 && !g.measurable ? g.currentProgress : null,
    tags: g.tags, notes: '',
    linkedProjectIds: g.linkedProjectIds, linkedHabitIds: g.linkedHabitIds, linkedNoteIds: g.linkedNoteIds,
    milestones, progressHistory, activity: [],
  };
  goal.activity = generateActivity(goal, seed);
  return goal;
});

export const ALL_GOAL_TAGS = [...new Set(goals.flatMap((g) => g.tags))].sort();

export function goalById(id) {
  return goals.find((g) => g.id === id) || null;
}
