// Atlas — Goals derived logic. Same split as habits/state.js: everything
// computable is a pure function here; data.js stays raw content.

import { goals, goalById, CATEGORY_CONFIG, STATUSES, createGoalId, createMilestoneId, createSubtaskId } from './data.js';
import { dateKey, todayDate, todayKey, daysUntil, formatDate } from '../date-utils.js';

// ================= PROGRESS (cascade: measurable > milestones > manual) =================
export function computeMilestoneProgress(milestone) {
  if (milestone.subtasks.length > 0) {
    const done = milestone.subtasks.filter((s) => s.done).length;
    return Math.round((done / milestone.subtasks.length) * 100);
  }
  return milestone.completed ? 100 : milestone.manualProgress ?? 0;
}

export function computeGoalProgress(goal) {
  if (goal.measurable) {
    const { targetValue, currentValue } = goal.measurable;
    return targetValue > 0 ? Math.round(Math.min(100, (currentValue / targetValue) * 100)) : 0;
  }
  if (goal.milestones.length > 0) {
    const total = goal.milestones.reduce((sum, m) => sum + computeMilestoneProgress(m), 0);
    return Math.round(total / goal.milestones.length);
  }
  return goal.manualProgressOverride ?? 0;
}

// ================= FORECAST ENGINE =================
// A real but simple model: recent velocity (progress/day over a trailing
// window) projected forward, confidence from how consistent that velocity
// has been, risk from comparing it to the pace the deadline actually
// requires. Not machine learning, not branded as "AI" anywhere in this
// module — see BUILD_LOG for why the spec's "AI Suggestions (UI-ready)"
// became a plainly-labeled Insights panel instead.
const FORECAST_WINDOW_DAYS = 21;

export function computeForecast(goal) {
  const progress = computeGoalProgress(goal);
  const empty = { velocityPerDay: 0, likelyCompletionDate: null, confidence: 0, requiredPacePerDay: null, risk: 'unknown' };

  if (goal.status === 'Completed' || goal.status === 'Cancelled') return empty;
  const history = goal.progressHistory;
  if (!history || history.length < 2) return empty;

  const cutoff = new Date(todayDate());
  cutoff.setDate(cutoff.getDate() - FORECAST_WINDOW_DAYS);
  const cutoffKey = dateKey(cutoff);
  const recent = history.filter((p) => p.date >= cutoffKey);
  const windowPoints = recent.length >= 2 ? recent : history.slice(-2);

  const first = windowPoints[0];
  const last = windowPoints[windowPoints.length - 1];
  const daySpan = Math.max(1, Math.round((new Date(`${last.date}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / 86400000));
  const velocityPerDay = (last.value - first.value) / daySpan;

  const remaining = 100 - progress;
  let likelyCompletionDate = null;
  if (velocityPerDay > 0.05 && remaining > 0) {
    const daysNeeded = Math.ceil(remaining / velocityPerDay);
    const d = new Date(todayDate());
    d.setDate(d.getDate() + daysNeeded);
    likelyCompletionDate = dateKey(d);
  }

  // Confidence: lower variance between consecutive samples = more
  // confidence the velocity above is representative, not a lucky streak.
  const deltas = [];
  for (let i = 1; i < windowPoints.length; i += 1) deltas.push(windowPoints[i].value - windowPoints[i - 1].value);
  const mean = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / (deltas.length || 1);
  const stdDev = Math.sqrt(variance);
  const rawConfidence = mean > 0 ? Math.max(0, 1 - stdDev / (Math.abs(mean) + 0.5)) : 0.15;
  const confidence = Math.round(Math.max(5, Math.min(95, rawConfidence * 100)));

  let requiredPacePerDay = null;
  let risk = remaining <= 0 ? 'low' : 'unknown';
  if (goal.deadline) {
    const daysLeft = Math.max(1, daysUntil(goal.deadline));
    requiredPacePerDay = remaining / daysLeft;
    if (velocityPerDay <= 0.01) risk = remaining > 0 ? 'high' : 'low';
    else {
      const ratio = requiredPacePerDay / velocityPerDay;
      risk = ratio > 1.5 ? 'high' : ratio > 1.05 ? 'medium' : 'low';
    }
  }

  return { velocityPerDay, likelyCompletionDate, confidence, requiredPacePerDay, risk };
}

// Plainly rule-based, plainly labeled as such in the UI (not "AI").
export function generateInsight(goal) {
  const progress = computeGoalProgress(goal);
  const forecast = computeForecast(goal);
  if (goal.status === 'Completed') return { tone: 'success', message: 'Goal completed — nice work.' };
  if (goal.status === 'Cancelled') return { tone: 'neutral', message: 'This goal was cancelled. Duplicate it if you want to pick the idea back up later.' };
  if (goal.status === 'Paused') return { tone: 'neutral', message: 'This goal is paused. Resume it when you\u2019re ready to pick the pace back up.' };
  if (goal.status === 'Not Started') return { tone: 'neutral', message: 'Not started yet — adding a first milestone usually makes it easier to begin.' };
  if (goal.deadline && daysUntil(goal.deadline) < 0 && progress < 100) return { tone: 'danger', message: 'This goal is past its deadline. Consider updating the date or breaking it into a smaller next step.' };
  if (forecast.risk === 'high') return { tone: 'danger', message: `At the current pace, this won\u2019t reach the deadline. Needed pace is roughly ${forecast.requiredPacePerDay?.toFixed(1)}%/day vs the recent ${forecast.velocityPerDay.toFixed(1)}%/day.` };
  if (forecast.risk === 'medium') return { tone: 'warning', message: 'Pace is a bit behind what the deadline needs \u2014 worth a small push soon.' };
  if (goal.milestones.length && goal.milestones.every((m) => !m.completed) && progress === 0) return { tone: 'neutral', message: 'No milestones completed yet \u2014 finishing the first one tends to build momentum.' };
  return { tone: 'success', message: 'On track at the current pace.' };
}

// ================= ACTIVITY / PROGRESS HISTORY =================
function recordActivity(goal, type, message) {
  goal.activity.push({ id: `act-${goal.id}-${goal.activity.length}-${Date.now()}`, date: todayKey(), type, message });
  goal.updatedAt = todayKey();
}

function snapshotProgress(goal) {
  const value = computeGoalProgress(goal);
  const last = goal.progressHistory[goal.progressHistory.length - 1];
  if (last && last.date === todayKey()) last.value = value; // one snapshot per day, update in place
  else goal.progressHistory.push({ date: todayKey(), value });
}

// ================= DASHBOARD-LEVEL STATS =================
export function computeGoalDashboardStats() {
  const active = goals.filter((g) => !g.archived);
  const completed = goals.filter((g) => g.status === 'Completed');
  const progresses = active.map((g) => computeGoalProgress(g));
  const avgProgress = progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0;

  const completionTimes = completed
    .filter((g) => g.completedAt)
    .map((g) => Math.round((new Date(`${g.completedAt}T00:00:00`) - new Date(`${g.createdAt}T00:00:00`)) / 86400000));
  const avgCompletionDays = completionTimes.length ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) : null;

  const runningDays = active.map((g) => Math.round((todayDate() - new Date(`${g.createdAt}T00:00:00`)) / 86400000));
  const longestRunningDays = runningDays.length ? Math.max(...runningDays) : 0;

  const byCategory = {};
  for (const g of active) {
    byCategory[g.category] = byCategory[g.category] || { count: 0, progressSum: 0 };
    byCategory[g.category].count += 1;
    byCategory[g.category].progressSum += computeGoalProgress(g);
  }
  let mostProductiveCategory = null;
  let bestAvg = -1;
  for (const [cat, v] of Object.entries(byCategory)) {
    const avg = v.progressSum / v.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      mostProductiveCategory = cat;
    }
  }

  const withDeadline = active.filter((g) => g.deadline);
  const upcoming = withDeadline.filter((g) => daysUntil(g.deadline) >= 0 && computeGoalProgress(g) < 100).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));
  const missed = withDeadline.filter((g) => daysUntil(g.deadline) < 0 && computeGoalProgress(g) < 100);

  let mostDelayedGoal = null;
  let worstOverdue = 0;
  for (const g of missed) {
    const overdue = -daysUntil(g.deadline);
    if (overdue > worstOverdue) {
      worstOverdue = overdue;
      mostDelayedGoal = g;
    }
  }

  const allMilestones = active.flatMap((g) => g.milestones);
  const milestonesCompleted = allMilestones.filter((m) => m.completed).length;

  const risks = active.map((g) => computeForecast(g).risk);
  const healthScore = active.length ? Math.round((risks.filter((r) => r === 'low').length / active.length) * 100) : 0;

  return {
    goalsCompleted: completed.length,
    goalsActive: active.filter((g) => g.status !== 'Completed').length,
    goalsArchived: goals.length - active.length,
    completionRate: goals.length ? Math.round((completed.length / goals.length) * 100) : 0,
    averageProgress: avgProgress,
    averageCompletionDays: avgCompletionDays,
    longestRunningDays,
    mostProductiveCategory,
    mostDelayedGoal,
    upcomingDeadlineCount: upcoming.length,
    missedDeadlineCount: missed.length,
    milestonesCompleted,
    milestonesTotal: allMilestones.length,
    habitsLinked: new Set(active.flatMap((g) => g.linkedHabitIds)).size,
    projectsLinked: new Set(active.flatMap((g) => g.linkedProjectIds)).size,
    goalHealthScore: healthScore,
  };
}

export function getUpcomingDeadlines(limit = 5) {
  return goals
    .filter((g) => !g.archived && g.deadline && computeGoalProgress(g) < 100)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, limit);
}

export function getRecentlyCompleted(limit = 5) {
  return goals
    .filter((g) => g.status === 'Completed' && g.completedAt)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, limit);
}

export function getRecentActivity(limit = 8) {
  const all = goals.flatMap((g) => g.activity.map((a) => ({ ...a, goalId: g.id, goalTitle: g.title })));
  return all.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

// ================= FILTER / SORT / SEARCH =================
let state = {
  search: '',
  categoryFilter: new Set(),
  timeframeFilter: new Set(),
  priorityFilter: new Set(),
  statusFilter: new Set(),
  favoritesOnly: false,
  showArchived: false,
  sortBy: 'deadline',
};
const listeners = new Set();

export function getState() {
  return state;
}
export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function resetFilters() {
  setState({ search: '', categoryFilter: new Set(), timeframeFilter: new Set(), priorityFilter: new Set(), statusFilter: new Set(), favoritesOnly: false });
}

// Simple fuzzy match: every character of the query must appear in order
// somewhere in the target. Only meaningful against something short like a
// title — applying it to a giant concatenated blob (title+description+
// tags+milestones) made nearly any short query match nearly everything,
// since a long enough haystack can satisfy almost any subsequence by
// chance. Caught by the runtime test (see BUILD_LOG); fixed by restricting
// the fuzzy pass to the title and using plain substring matching for
// everything else.
function fuzzyIncludes(target, query) {
  if (!query) return true;
  const t = target.toLowerCase();
  let i = 0;
  for (const ch of query.toLowerCase()) {
    i = t.indexOf(ch, i);
    if (i === -1) return false;
    i += 1;
  }
  return true;
}

export function filterGoals(list, f) {
  const q = f.search.trim();
  return list.filter((g) => {
    if (!f.showArchived && g.archived) return false;
    if (f.statusFilter.size && !f.statusFilter.has(g.status)) return false;
    if (f.categoryFilter.size && !f.categoryFilter.has(g.category)) return false;
    if (f.timeframeFilter.size && !f.timeframeFilter.has(g.timeframe)) return false;
    if (f.priorityFilter.size && !f.priorityFilter.has(g.priority)) return false;
    if (f.favoritesOnly && !g.favorite) return false;
    if (q) {
      const titleMatch = fuzzyIncludes(g.title, q);
      const substringMatch = [g.title, g.description, ...g.tags, ...g.milestones.map((m) => m.title)].some((field) => field.toLowerCase().includes(q.toLowerCase()));
      if (!titleMatch && !substringMatch) return false;
    }
    return true;
  });
}

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const RISK_ORDER = { high: 0, medium: 1, low: 2, unknown: 3 };

export function sortGoals(list, sortBy) {
  const arr = [...list];
  switch (sortBy) {
    case 'priority':
      return arr.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    case 'progress':
      return arr.sort((a, b) => computeGoalProgress(b) - computeGoalProgress(a));
    case 'alphabetical':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'newest':
      return arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    case 'oldest':
      return arr.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    case 'updatedAt':
      return arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    case 'risk':
      return arr.sort((a, b) => RISK_ORDER[computeForecast(a).risk] - RISK_ORDER[computeForecast(b).risk]);
    case 'confidence':
      return arr.sort((a, b) => computeForecast(b).confidence - computeForecast(a).confidence);
    case 'deadline':
    default:
      return arr.sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return daysUntil(a.deadline) - daysUntil(b.deadline);
      });
  }
}

export const SORT_OPTIONS = [
  { id: 'deadline', label: 'Deadline' },
  { id: 'priority', label: 'Priority' },
  { id: 'progress', label: 'Progress %' },
  { id: 'risk', label: 'Risk' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'alphabetical', label: 'Alphabetical' },
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'updatedAt', label: 'Recently updated' },
];

let lastKey = null;
let lastResult = null;
export function getVisibleGoals(allGoals, f) {
  const key = JSON.stringify({
    search: f.search, cat: [...f.categoryFilter].sort(), tf: [...f.timeframeFilter].sort(), pri: [...f.priorityFilter].sort(),
    status: [...f.statusFilter].sort(), fav: f.favoritesOnly, arch: f.showArchived, sort: f.sortBy, n: allGoals.length,
  });
  if (key === lastKey) return lastResult;
  lastKey = key;
  lastResult = sortGoals(filterGoals(allGoals, f), f.sortBy);
  return lastResult;
}
export function invalidateVisibleGoalsCache() {
  lastKey = null;
}

// ================= CRUD — GOALS =================
export function createGoal(data) {
  const now = todayKey();
  const goal = {
    description: '', icon: '\u{1F3AF}', coverColor: 'blue', priority: 'Medium', status: 'Not Started',
    deadline: null, startDate: now, favorite: false, archived: false, measurable: null, manualProgressOverride: 0,
    tags: [], notes: '', linkedProjectIds: [], linkedHabitIds: [], linkedNoteIds: [], milestones: [], progressHistory: [{ date: now, value: 0 }], activity: [],
    ...data,
    id: createGoalId(), createdAt: now, updatedAt: now, completedAt: null,
  };
  recordActivity(goal, 'created', 'Goal created');
  goals.push(goal);
  invalidateVisibleGoalsCache();
  return goal;
}

export function updateGoal(id, patch) {
  const g = goalById(id);
  if (!g) return null;
  const wasStatus = g.status;
  Object.assign(g, patch, { updatedAt: todayKey() });
  if (patch.status && patch.status !== wasStatus) {
    recordActivity(g, 'status', `Status changed to ${patch.status}`);
    if (patch.status === 'Completed') {
      g.completedAt = todayKey();
      if (g.measurable) g.measurable.currentValue = g.measurable.targetValue;
      else g.manualProgressOverride = 100;
    }
  }
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return g;
}

export function deleteGoal(id) {
  const idx = goals.findIndex((g) => g.id === id);
  if (idx !== -1) goals.splice(idx, 1);
  invalidateVisibleGoalsCache();
}

export function duplicateGoal(id) {
  const g = goalById(id);
  if (!g) return null;
  const now = todayKey();
  const copy = {
    ...g, id: createGoalId(), title: `${g.title} (copy)`, favorite: false, status: 'Not Started',
    completedAt: null, createdAt: now, updatedAt: now,
    milestones: g.milestones.map((m) => ({ ...m, id: createMilestoneId(), completed: false, completedAt: null, subtasks: m.subtasks.map((s) => ({ ...s, id: createSubtaskId(), done: false })) })),
    progressHistory: [{ date: now, value: 0 }], activity: [],
  };
  recordActivity(copy, 'created', `Duplicated from \u201c${g.title}\u201d`);
  goals.push(copy);
  invalidateVisibleGoalsCache();
  return copy;
}

export function toggleFavorite(id) {
  const g = goalById(id);
  if (g) {
    g.favorite = !g.favorite;
    invalidateVisibleGoalsCache();
  }
  return g;
}

export function toggleArchived(id) {
  const g = goalById(id);
  if (g) {
    g.archived = !g.archived;
    invalidateVisibleGoalsCache();
  }
  return g;
}

export function updateMeasurableValue(id, currentValue) {
  const g = goalById(id);
  if (!g || !g.measurable) return null;
  g.measurable.currentValue = Math.max(0, currentValue);
  g.updatedAt = todayKey();
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return g;
}

// ================= CRUD — MILESTONES =================
export function addMilestone(goalId, data) {
  const g = goalById(goalId);
  if (!g) return null;
  const milestone = { description: '', deadline: null, completed: false, completedAt: null, priority: 'Medium', notes: '', estimatedHours: null, actualHours: null, manualProgress: 0, subtasks: [], ...data, id: createMilestoneId() };
  g.milestones.push(milestone);
  recordActivity(g, 'milestone', `Added milestone \u201c${milestone.title}\u201d`);
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return milestone;
}

export function updateMilestone(goalId, milestoneId, patch) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  if (!m) return null;
  Object.assign(m, patch);
  g.updatedAt = todayKey();
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return m;
}

export function toggleMilestoneComplete(goalId, milestoneId) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  if (!m) return null;
  m.completed = !m.completed;
  m.completedAt = m.completed ? todayKey() : null;
  if (m.completed) m.subtasks.forEach((s) => (s.done = true));
  recordActivity(g, 'milestone', m.completed ? `Completed milestone \u201c${m.title}\u201d` : `Reopened milestone \u201c${m.title}\u201d`);
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return m;
}

export function deleteMilestone(goalId, milestoneId) {
  const g = goalById(goalId);
  if (!g) return;
  g.milestones = g.milestones.filter((m) => m.id !== milestoneId);
  g.updatedAt = todayKey();
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
}

export function duplicateMilestone(goalId, milestoneId) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  if (!m) return null;
  const copy = { ...m, id: createMilestoneId(), title: `${m.title} (copy)`, completed: false, completedAt: null, subtasks: m.subtasks.map((s) => ({ ...s, id: createSubtaskId(), done: false })) };
  g.milestones.push(copy);
  invalidateVisibleGoalsCache();
  return copy;
}

// ================= CRUD — SUBTASKS =================
export function addSubtask(goalId, milestoneId, title) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  if (!m) return null;
  const subtask = { id: createSubtaskId(), title, done: false };
  m.subtasks.push(subtask);
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return subtask;
}

export function toggleSubtask(goalId, milestoneId, subtaskId) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  const s = m?.subtasks.find((x) => x.id === subtaskId);
  if (!s) return null;
  s.done = !s.done;
  if (m.subtasks.every((x) => x.done) && !m.completed) {
    m.completed = true;
    m.completedAt = todayKey();
    recordActivity(g, 'milestone', `Completed milestone \u201c${m.title}\u201d`);
  } else if (!m.subtasks.every((x) => x.done) && m.completed) {
    m.completed = false;
    m.completedAt = null;
  }
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
  return s;
}

export function deleteSubtask(goalId, milestoneId, subtaskId) {
  const g = goalById(goalId);
  const m = g?.milestones.find((x) => x.id === milestoneId);
  if (!m) return;
  m.subtasks = m.subtasks.filter((s) => s.id !== subtaskId);
  snapshotProgress(g);
  invalidateVisibleGoalsCache();
}

export { CATEGORY_CONFIG, STATUSES };
