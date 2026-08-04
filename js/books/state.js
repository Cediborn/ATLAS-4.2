// Atlas — Books page state. Same discipline as goals/state.js and
// habits/state.js: pure functions for anything computable, a small
// page-local store for anything that's genuinely UI state. Streak/heatmap
// math mirrors habits/state.js; forecast math mirrors goals/state.js —
// same techniques, applied to pages instead of habit-days or goal-%.

import {
  books, sessions, quotes, highlights, bookNotes, collections, bookById,
  STATUS_CONFIG, GENRE_CONFIG, HIGHLIGHT_COLOR_CONFIG,
} from './data.js';
import { dateKey, todayDate, todayKey, monthGridDays } from '../date-utils.js';

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ---- Progress \u2014 always computed, never stored (same "don't store what's
// derivable" rule as every other module here) ----
export function computeProgress(book) {
  if (!book.totalPages) return 0;
  return Math.max(0, Math.min(100, Math.round((book.currentPage / book.totalPages) * 100)));
}

// ================= Sessions =================
export function getSessionsForBook(bookId) {
  return sessions.filter((s) => s.bookId === bookId).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Index rebuilt after every mutation rather than kept incrementally in sync
// piecemeal \u2014 the session list is small enough (a few hundred rows) that a
// full rebuild is cheap and impossible to get subtly out of sync, unlike
// Habits' per-habit completion Map which is large enough to need incremental updates.
let sessionDateSet = new Set();
let pagesPerDay = new Map();
function rebuildSessionIndexes() {
  sessionDateSet = new Set(sessions.map((s) => s.date));
  pagesPerDay = new Map();
  for (const s of sessions) {
    const pages = Math.max(0, s.endPage - s.startPage);
    pagesPerDay.set(s.date, (pagesPerDay.get(s.date) || 0) + pages);
  }
}
rebuildSessionIndexes();

// ---- Reading streak \u2014 a day "counts" if at least one session was logged
// that day, across every book (unlike Habits, there's no per-item due/skip
// concept here \u2014 you either read something today or you didn't). ----
const STREAK_WALK_SAFETY = 2000;
export function computeReadingStreak() {
  const todayK = todayKey();
  const cursor = todayDate();
  if (!sessionDateSet.has(todayK)) cursor.setDate(cursor.getDate() - 1); // today's still open \u2014 walk starts at yesterday

  let current = 0;
  const walk = new Date(cursor);
  for (let steps = 0; steps < STREAK_WALK_SAFETY; steps += 1) {
    if (sessionDateSet.has(dateKey(walk))) {
      current += 1;
      walk.setDate(walk.getDate() - 1);
    } else break;
  }

  const sortedDates = [...sessionDateSet].sort();
  let longest = 0;
  let running = 0;
  let prev = null;
  for (const d of sortedDates) {
    if (prev) {
      const gap = Math.round((new Date(`${d}T00:00:00`) - new Date(`${prev}T00:00:00`)) / 86400000);
      running = gap === 1 ? running + 1 : 1;
    } else {
      running = 1;
    }
    longest = Math.max(longest, running);
    prev = d;
  }
  return { current, longest: Math.max(longest, current) };
}

// ---- Monthly reading heatmap \u2014 same GitHub-style grid as Habits, fed
// through the same promoted HeatmapGrid component (see js/components.js).
// Cells carry a pre-built `label`, a small generalization to that shared
// component so "45 pages read" can replace Habits' "%(done/due)" phrasing
// without touching Habits' own call site. ----
export function buildReadingHeatmapMonth(monthDate) {
  const grid = monthGridDays(monthDate);
  const todayK = todayKey();
  return grid.map((cell) => {
    if (!cell.inCurrentMonth || cell.key > todayK) {
      return { ...cell, level: null, completionPct: null, pages: 0 };
    }
    const pages = pagesPerDay.get(cell.key) || 0;
    let level = 'none';
    if (pages === 0) level = 'none';
    else if (pages >= 80) level = 'perfect';
    else if (pages >= 40) level = 'high';
    else if (pages >= 15) level = 'medium';
    else level = 'low';
    const dateLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(cell.date);
    return { ...cell, level, completionPct: pages, doneCount: pages, dueCount: pages, pages, label: `${dateLabel}: ${pages} page${pages === 1 ? '' : 's'} read` };
  });
}

// ================= Forecast (per currently-reading/re-reading book) =================
// Trailing pace across the book's own logged sessions (not a fixed window \u2014
// most books don't have 21+ days of history the way Goals' progress-history
// does), a likely-finish date projected forward from it, a confidence score
// from how consistent session-to-session pace has actually been, and a risk
// level only when the book has a real `targetFinishDate` to be at risk
// against \u2014 same "risk: unknown without a real deadline" rule as Goals.
export function computeReadingForecast(book) {
  const empty = { risk: 'unknown', likelyCompletionDate: null, confidence: 0, velocityPerDay: 0, velocityLabel: null, requiredPacePerDay: null, requiredPaceLabel: null };
  if (book.status !== 'Currently Reading' && book.status !== 'Re-reading') return empty;

  const bookSessions = getSessionsForBook(book.id);
  if (bookSessions.length < 2) return empty;

  const first = bookSessions[0];
  const totalPagesLogged = bookSessions.reduce((sum, s) => sum + Math.max(0, s.endPage - s.startPage), 0);
  const daySpan = Math.max(1, Math.round((new Date(`${todayKey()}T00:00:00`) - new Date(`${first.date}T00:00:00`)) / 86400000));
  const velocityPerDay = totalPagesLogged / daySpan;
  const pagesRemaining = Math.max(0, book.totalPages - book.currentPage);
  const daysToFinish = velocityPerDay > 0 ? Math.ceil(pagesRemaining / velocityPerDay) : null;
  const likelyCompletionDate = daysToFinish !== null ? dateKey(addDays(todayDate(), daysToFinish)) : null;

  const perSessionPages = bookSessions.map((s) => Math.max(0, s.endPage - s.startPage));
  const mean = perSessionPages.reduce((a, b) => a + b, 0) / perSessionPages.length;
  const variance = perSessionPages.reduce((a, b) => a + (b - mean) ** 2, 0) / perSessionPages.length;
  const stdDev = Math.sqrt(variance);
  const confidence = mean > 0 ? Math.max(10, Math.min(95, Math.round(100 - (stdDev / mean) * 60))) : 30;

  let requiredPacePerDay = null;
  let risk = 'unknown';
  if (book.targetFinishDate) {
    const daysUntilTarget = Math.max(1, Math.round((new Date(`${book.targetFinishDate}T00:00:00`) - new Date(`${todayKey()}T00:00:00`)) / 86400000));
    requiredPacePerDay = pagesRemaining / daysUntilTarget;
    const ratio = requiredPacePerDay > 0 ? velocityPerDay / requiredPacePerDay : 1;
    risk = ratio >= 1 ? 'low' : ratio >= 0.6 ? 'medium' : 'high';
  }

  return {
    risk, likelyCompletionDate, confidence, velocityPerDay,
    velocityLabel: `${velocityPerDay.toFixed(1)} pages/day`,
    requiredPacePerDay,
    requiredPaceLabel: requiredPacePerDay !== null ? `${requiredPacePerDay.toFixed(1)} pages/day` : null,
  };
}

// ================= Dashboard stats (computed, not stored \u2014 same rule as
// Goals'/Habits' own dashboard stat blocks) =================
export function computeBookDashboardStats() {
  const active = books.filter((b) => !b.archived);
  const completed = active.filter((b) => b.status === 'Completed');
  const currentlyReading = active.filter((b) => b.status === 'Currently Reading' || b.status === 'Re-reading');
  const wishlist = active.filter((b) => b.status === 'Want to Read');
  const started = active.filter((b) => b.status !== 'Want to Read');

  const todayK = todayKey();
  const yearK = todayK.slice(0, 4);
  const monthK = todayK.slice(0, 7);

  const pagesToday = pagesPerDay.get(todayK) || 0;
  let pagesThisWeek = 0;
  let pagesThisYear = 0;
  for (const [date, pages] of pagesPerDay.entries()) {
    if (date.startsWith(yearK)) pagesThisYear += pages;
    const daysAgo = Math.round((new Date(`${todayK}T00:00:00`) - new Date(`${date}T00:00:00`)) / 86400000);
    if (daysAgo >= 0 && daysAgo < 7) pagesThisWeek += pages;
  }

  const readingHours = Math.round((sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / 60) * 10) / 10;
  const ratings = active.map((b) => b.rating).filter((r) => r !== null && r !== undefined);
  const averageRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const booksThisYear = completed.filter((b) => (b.dateCompleted || '').startsWith(yearK)).length;
  const booksThisMonth = completed.filter((b) => (b.dateCompleted || '').startsWith(monthK)).length;
  const streak = computeReadingStreak();

  const genreCounts = new Map();
  for (const b of completed) for (const g of b.genres) genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
  const mostReadGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const authorCounts = new Map();
  for (const b of completed) authorCounts.set(b.author, (authorCounts.get(b.author) || 0) + 1);
  const mostReadAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const monthTotals = new Map();
  for (const [date, pages] of pagesPerDay.entries()) monthTotals.set(date.slice(0, 7), (monthTotals.get(date.slice(0, 7)) || 0) + pages);
  const topMonthKey = [...monthTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostProductiveMonth = topMonthKey ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${topMonthKey}-01T00:00:00`)) : null;

  return {
    booksRead: completed.length,
    currentlyReadingCount: currentlyReading.length,
    wishlistCount: wishlist.length,
    favoritesCount: active.filter((b) => b.favorite).length,
    readingStreak: streak.current,
    longestStreak: streak.longest,
    pagesReadThisYear: pagesThisYear,
    readingHours,
    sessionsCount: sessions.length,
    averageRating,
    booksThisYear,
    booksThisMonth,
    pagesToday,
    pagesThisWeek,
    completionRate: started.length ? Math.round((completed.length / started.length) * 100) : 0,
    averageBookLength: active.length ? Math.round(active.reduce((sum, b) => sum + b.totalPages, 0) / active.length) : 0,
    mostReadGenre,
    mostReadAuthor,
    mostProductiveMonth,
  };
}

export function genreBreakdown() {
  const counts = new Map();
  for (const b of books.filter((x) => !x.archived)) for (const g of b.genres) counts.set(g, (counts.get(g) || 0) + 1);
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count, color: GENRE_CONFIG[genre]?.color || 'slate' }))
    .sort((a, b) => b.count - a.count);
}

export function statusBreakdown() {
  const counts = new Map();
  for (const b of books.filter((x) => !x.archived)) counts.set(b.status, (counts.get(b.status) || 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count, color: STATUS_CONFIG[status]?.color || 'neutral' }));
}

// ================= Insights (mirrors Goals' 3-panel aside) =================
export function getCurrentlyReadingPreview(limit = 5) {
  return books
    .filter((b) => (b.status === 'Currently Reading' || b.status === 'Re-reading') && !b.archived)
    .sort((a, b) => new Date(b.lastOpened || b.updatedAt) - new Date(a.lastOpened || a.updatedAt))
    .slice(0, limit);
}
export function getRecentlyCompleted(limit = 5) {
  return books
    .filter((b) => b.status === 'Completed' && b.dateCompleted)
    .sort((a, b) => new Date(b.dateCompleted) - new Date(a.dateCompleted))
    .slice(0, limit);
}
export function getRecentQuotes(limit = 5) {
  return [...quotes].sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)).slice(0, limit);
}

// ================= Activity feed (computed on demand, not stored \u2014 unlike
// Goals' own append-only activity[], Books has enough event *types*
// (sessions/quotes/highlights/notes/status) that storing a parallel log
// would just be duplicating what sessions/quotes/highlights/notes already are) =================
export function buildBookActivity(book) {
  const events = [];
  events.push({ id: `act-${book.id}-added`, date: book.createdAt, type: 'created', message: 'Added to library' });
  if (book.dateStarted) events.push({ id: `act-${book.id}-started`, date: book.dateStarted, type: 'status', message: 'Started reading' });
  getSessionsForBook(book.id).forEach((s) => {
    const pages = Math.max(0, s.endPage - s.startPage);
    events.push({ id: `act-session-${s.id}`, date: s.date, type: 'session', message: `Logged a session \u2014 ${pages} page${pages === 1 ? '' : 's'}` });
  });
  getQuotesForBook(book.id).forEach((q) => events.push({ id: `act-quote-${q.id}`, date: q.dateAdded, type: 'quote', message: 'Saved a quote' }));
  getHighlightsForBook(book.id).forEach((h) => events.push({ id: `act-highlight-${h.id}`, date: h.dateAdded, type: 'highlight', message: 'Added a highlight' }));
  getNotesForBook(book.id).forEach((n) => events.push({ id: `act-note-${n.id}`, date: n.dateAdded, type: 'note', message: `Note \u2014 \u201c${n.title}\u201d` }));
  if (book.dateCompleted) events.push({ id: `act-${book.id}-completed`, date: book.dateCompleted, type: 'completed', message: 'Finished the book' });
  return events.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ================= Page UI state (search/filter/sort \u2014 view state, not app state) =================
let state = {
  search: '',
  statusFilter: new Set(),
  genreFilter: new Set(),
  favoritesOnly: false,
  showArchived: false,
  sortBy: 'lastOpened',
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
  setState({ search: '', statusFilter: new Set(), genreFilter: new Set(), favoritesOnly: false });
}

export function filterBooks(list, f) {
  const q = f.search.trim().toLowerCase();
  return list.filter((b) => {
    if (!f.showArchived && b.archived) return false;
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q) && !b.tags.some((t) => t.toLowerCase().includes(q))) return false;
    if (f.statusFilter.size && !f.statusFilter.has(b.status)) return false;
    if (f.genreFilter.size && !b.genres.some((g) => f.genreFilter.has(g))) return false;
    if (f.favoritesOnly && !b.favorite) return false;
    return true;
  });
}

export function sortBooks(list, sortBy) {
  const arr = [...list];
  switch (sortBy) {
    case 'title':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'titleDesc':
      return arr.sort((a, b) => b.title.localeCompare(a.title));
    case 'author':
      return arr.sort((a, b) => a.author.localeCompare(b.author));
    case 'rating':
      return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'progress':
      return arr.sort((a, b) => computeProgress(b) - computeProgress(a));
    case 'pages':
      return arr.sort((a, b) => b.totalPages - a.totalPages);
    case 'publicationYear':
      return arr.sort((a, b) => (b.publicationYear || '0').localeCompare(a.publicationYear || '0'));
    case 'dateAdded':
      return arr.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    case 'lastOpened':
    default:
      return arr.sort((a, b) => new Date(b.lastOpened || b.updatedAt) - new Date(a.lastOpened || a.updatedAt));
  }
}

export const SORT_OPTIONS = [
  { id: 'lastOpened', label: 'Recently opened' },
  { id: 'dateAdded', label: 'Date added' },
  { id: 'title', label: 'Title A\u2013Z' },
  { id: 'titleDesc', label: 'Title Z\u2013A' },
  { id: 'author', label: 'Author' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'progress', label: 'Progress' },
  { id: 'pages', label: 'Pages' },
  { id: 'publicationYear', label: 'Publication date' },
];

// Memoized filter+sort \u2014 same "Projects shipped without this and it caused
// a real stale-cache bug" reasoning as every module since (see BUILD_LOG).
let lastKey = null;
let lastResult = null;
export function getVisibleBooks(allBooks, f) {
  const key = JSON.stringify({
    search: f.search, status: [...f.statusFilter].sort(), genre: [...f.genreFilter].sort(),
    fav: f.favoritesOnly, archived: f.showArchived, sort: f.sortBy, n: allBooks.length,
  });
  if (key === lastKey) return lastResult;
  lastKey = key;
  lastResult = sortBooks(filterBooks(allBooks, f), f.sortBy);
  return lastResult;
}
export function invalidateVisibleBooksCache() {
  lastKey = null;
}

// ================= CRUD \u2014 mutates data.js's own arrays directly, same
// pattern as goals/state.js and habits/state.js =================
export function createBook(data) {
  const now = todayKey();
  const book = {
    subtitle: null, publisher: null, publicationYear: null, isbn: null, language: 'English',
    genres: [], tags: [], status: 'Want to Read', rating: null, favorite: false, archived: false,
    dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null,
    review: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], notes: '',
    ...data,
    id: `b${Date.now()}`, dateAdded: now, createdAt: now, updatedAt: now,
  };
  books.push(book);
  invalidateVisibleBooksCache();
  return book;
}

export function updateBook(id, patch) {
  const b = bookById(id);
  if (!b) return null;
  Object.assign(b, patch, { updatedAt: todayKey() });
  invalidateVisibleBooksCache();
  return b;
}

export function deleteBook(id) {
  const idx = books.findIndex((b) => b.id === id);
  if (idx !== -1) books.splice(idx, 1);
  // Clean up orphaned child records rather than leaving them pointing at a
  // book id that no longer resolves.
  for (const arr of [sessions, quotes, highlights, bookNotes]) {
    for (let i = arr.length - 1; i >= 0; i -= 1) if (arr[i].bookId === id) arr.splice(i, 1);
  }
  for (const c of collections) {
    const ci = c.bookIds.indexOf(id);
    if (ci !== -1) c.bookIds.splice(ci, 1);
  }
  rebuildSessionIndexes();
  invalidateVisibleBooksCache();
}

export function duplicateBook(id) {
  const b = bookById(id);
  if (!b) return null;
  const now = todayKey();
  // A fresh copy of the catalog entry, not a clone of someone's reading
  // history \u2014 sessions/quotes/highlights/notes are keyed to the original
  // book's id and duplicating those would misattribute real reading history
  // to a book nobody has actually opened yet.
  const copy = {
    ...b, id: `b${Date.now()}`, title: `${b.title} (copy)`, status: 'Want to Read',
    currentPage: 0, dateStarted: null, dateCompleted: null, lastOpened: null,
    rating: null, review: null, favorite: false, targetFinishDate: null,
    dateAdded: now, createdAt: now, updatedAt: now,
  };
  books.push(copy);
  invalidateVisibleBooksCache();
  return copy;
}

export function toggleFavorite(id) {
  const b = bookById(id);
  if (b) {
    b.favorite = !b.favorite;
    invalidateVisibleBooksCache();
  }
  return b;
}

export function toggleArchived(id) {
  const b = bookById(id);
  if (b) {
    b.archived = !b.archived;
    invalidateVisibleBooksCache();
  }
  return b;
}

// Handles the timestamps a status transition implies, same idea as Goals'
// milestone-completion cascade \u2014 the UI action is one click, but several
// fields legitimately need to move together.
export function setStatus(id, status) {
  const b = bookById(id);
  if (!b) return null;
  const now = todayKey();
  b.status = status;
  b.lastOpened = now;
  if (status === 'Currently Reading' && !b.dateStarted) b.dateStarted = now;
  if (status === 'Completed' && !b.dateCompleted) {
    b.dateCompleted = now;
    b.currentPage = b.totalPages;
  }
  b.updatedAt = now;
  invalidateVisibleBooksCache();
  return b;
}

export function updateProgress(id, currentPage) {
  const b = bookById(id);
  if (!b) return null;
  b.currentPage = Math.max(0, Math.min(b.totalPages, Math.round(currentPage)));
  b.lastOpened = todayKey();
  b.updatedAt = todayKey();
  if (b.status === 'Want to Read') {
    b.status = 'Currently Reading';
    b.dateStarted = b.dateStarted || todayKey();
  }
  invalidateVisibleBooksCache();
  return b;
}

export function completeBook(id, { rating = null, review = null } = {}) {
  const b = bookById(id);
  if (!b) return null;
  const now = todayKey();
  b.status = 'Completed';
  b.dateCompleted = b.dateCompleted || now;
  b.currentPage = b.totalPages;
  b.lastOpened = now;
  b.updatedAt = now;
  if (rating !== null) b.rating = rating;
  if (review !== null) b.review = review;
  invalidateVisibleBooksCache();
  return b;
}

// ---- Sessions ----
export function addSession(bookId, data) {
  const b = bookById(bookId);
  if (!b) return null;
  const startPage = data.startPage ?? b.currentPage;
  const endPage = Math.max(startPage, data.endPage ?? startPage);
  let durationMinutes = data.durationMinutes;
  if (!durationMinutes && data.startTime && data.endTime) {
    const [sh, sm] = data.startTime.split(':').map(Number);
    const [eh, em] = data.endTime.split(':').map(Number);
    durationMinutes = Math.max(1, (eh * 60 + em) - (sh * 60 + sm));
  }
  const session = {
    id: `rs-${bookId}-${Date.now()}`, bookId, date: data.date || todayKey(),
    startTime: data.startTime || null, endTime: data.endTime || null,
    durationMinutes: durationMinutes || 0, startPage, endPage,
    mood: data.mood || null, notes: data.notes || '',
  };
  sessions.push(session);
  rebuildSessionIndexes();
  if (endPage > b.currentPage) updateProgress(bookId, endPage);
  else {
    b.lastOpened = session.date;
    invalidateVisibleBooksCache();
  }
  return session;
}

export function deleteSession(sessionId) {
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx !== -1) sessions.splice(idx, 1);
  rebuildSessionIndexes();
}

// ---- Quotes ----
export function getQuotesForBook(bookId) {
  return quotes.filter((q) => q.bookId === bookId).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}
export function addQuote(bookId, data) {
  const quote = { id: `q-${bookId}-${Date.now()}`, bookId, page: data.page ?? null, chapter: data.chapter || null, text: data.text, tags: data.tags || [], favorite: false, dateAdded: todayKey() };
  quotes.push(quote);
  return quote;
}
export function toggleQuoteFavorite(id) {
  const q = quotes.find((x) => x.id === id);
  if (q) q.favorite = !q.favorite;
  return q;
}
export function deleteQuote(id) {
  const idx = quotes.findIndex((q) => q.id === id);
  if (idx !== -1) quotes.splice(idx, 1);
}

// ---- Highlights ----
export function getHighlightsForBook(bookId) {
  return highlights.filter((h) => h.bookId === bookId).sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
}
export function addHighlight(bookId, data) {
  const hl = { id: `hl-${bookId}-${Date.now()}`, bookId, page: data.page ?? null, chapter: data.chapter || null, text: data.text, color: data.color || 'Yellow', note: data.note || '', tags: data.tags || [], dateAdded: todayKey() };
  highlights.push(hl);
  return hl;
}
export function deleteHighlight(id) {
  const idx = highlights.findIndex((h) => h.id === id);
  if (idx !== -1) highlights.splice(idx, 1);
}

// ---- Notes (plain text this milestone \u2014 see BUILD_LOG \u00a78 on reusing the
// real Notes module's markdown editor once this section needs full parity) ----
export function getNotesForBook(bookId) {
  return bookNotes.filter((n) => n.bookId === bookId).sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
}
export function addNote(bookId, data) {
  const now = todayKey();
  const note = { id: `bn-${bookId}-${Date.now()}`, bookId, title: data.title || 'Untitled note', text: data.text || '', tags: data.tags || [], pinned: false, dateAdded: now, updatedAt: now };
  bookNotes.push(note);
  return note;
}
export function updateNote(id, patch) {
  const n = bookNotes.find((x) => x.id === id);
  if (!n) return null;
  Object.assign(n, patch, { updatedAt: todayKey() });
  return n;
}
export function toggleNotePinned(id) {
  const n = bookNotes.find((x) => x.id === id);
  if (n) n.pinned = !n.pinned;
  return n;
}
export function deleteNote(id) {
  const idx = bookNotes.findIndex((n) => n.id === id);
  if (idx !== -1) bookNotes.splice(idx, 1);
}

// ---- Collections (data + membership toggle; full standalone management UI deferred, see BUILD_LOG \u00a78) ----
export function getCollectionsForBook(bookId) {
  return collections.filter((c) => c.bookIds.includes(bookId));
}
export function toggleBookInCollection(collectionId, bookId) {
  const c = collections.find((x) => x.id === collectionId);
  if (!c) return null;
  const idx = c.bookIds.indexOf(bookId);
  if (idx === -1) c.bookIds.push(bookId);
  else c.bookIds.splice(idx, 1);
  return c;
}

export { HIGHLIGHT_COLOR_CONFIG };
