// Atlas — Books components. Presentation-only, same rule as
// goals/components.js: no DOM queries, no event listeners. view.js and
// book-detail.js wire behavior on top.

import { icon } from '../icons.js';
import { ProgressRing, emptyState } from '../components.js';
import { STATUS_CONFIG, GENRE_CONFIG, HIGHLIGHT_COLOR_CONFIG, MOOD_CONFIG } from './data.js';
import { computeProgress } from './state.js';
import { formatDate, timeAgo } from '../date-utils.js';

// ---- BookStatusBadge \u2014 own status vocabulary, same reasoning
// GoalStatusBadge gave for staying separate from Projects': Books' 7
// statuses (Paused/Dropped/Re-reading) don't line up with either existing
// system closely enough to share a union type. ----
export function BookStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: 'neutral' };
  return `<span class="book-status book-status--${cfg.color}">${status}</span>`;
}

// ---- BookActionMenu \u2014 same Edit/Duplicate/Favorite/Archive/Delete shape
// as GoalActionMenu/HabitActionMenu. Quick actions like "Continue reading" /
// "Mark complete" deliberately live in the detail panel instead of on the
// card \u2014 same choice Goals made for "Update progress"; the card is a
// summary you click into, not a second surface for the same actions. ----
export function BookActionMenu({ id, itemLabel, favorite, archived }) {
  return `
    <div class="action-menu">
      <button type="button" class="icon-btn action-menu__trigger" data-id="${id}" aria-label="Actions for ${itemLabel}" aria-haspopup="true" aria-expanded="false">
        ${icon('moreHorizontal', { size: 16 })}
      </button>
      <div class="menu action-menu__panel" hidden>
        <button type="button" class="menu__item" data-action="edit">${icon('edit', { size: 16 })}<span>Edit</span></button>
        <button type="button" class="menu__item" data-action="duplicate">${icon('copy', { size: 16 })}<span>Duplicate</span></button>
        <button type="button" class="menu__item" data-action="favorite">${icon('star', { size: 16 })}<span>${favorite ? 'Remove from favorites' : 'Add to favorites'}</span></button>
        <div class="menu__divider"></div>
        <button type="button" class="menu__item" data-action="archive">${icon('archive', { size: 16 })}<span>${archived ? 'Unarchive' : 'Archive'}</span></button>
        <button type="button" class="menu__item menu__item--danger" data-action="delete">${icon('trash', { size: 16 })}<span>Delete</span></button>
      </div>
    </div>`;
}

// ---- RatingStars \u2014 no precedent elsewhere in the app; half-star support
// via a gray base star + a colored copy clipped to a percentage width,
// stacked on top (the standard CSS technique for fractional star ratings \u2014
// no new icon needed, reuses the existing `star` glyph twice per position). ----
function starCell(pct, size) {
  return `<span class="rating-stars__star" style="width:${size}px;height:${size}px">
    ${icon('star', { size })}
    <span class="rating-stars__fill" style="width:${pct}%">${icon('star', { size })}</span>
  </span>`;
}
export function RatingStars({ value = 0, size = 16, interactive = false, bookId = null }) {
  const cells = [1, 2, 3, 4, 5].map((i) => ({ i, pct: Math.max(0, Math.min(100, (value - (i - 1)) * 100)) }));
  const label = value ? `${value} out of 5 stars` : 'Not rated';
  if (!interactive) {
    return `<span class="rating-stars" aria-label="${label}">${cells.map((c) => starCell(c.pct, size)).join('')}</span>`;
  }
  return `
    <span class="rating-stars rating-stars--interactive" data-book-id="${bookId}" aria-label="Rate this book">
      ${cells
        .map(
          (c) => `
        <span class="rating-stars__cell">
          ${starCell(c.pct, size)}
          <button type="button" class="rating-stars__hit rating-stars__hit--half" data-rate="${c.i - 0.5}" aria-label="Rate ${c.i - 0.5} stars"></button>
          <button type="button" class="rating-stars__hit rating-stars__hit--full" data-rate="${c.i}" aria-label="Rate ${c.i} stars"></button>
        </span>`
        )
        .join('')}
    </span>`;
}

export function GenreBadge({ genre }) {
  const cfg = GENRE_CONFIG[genre] || { color: 'slate' };
  return `<span class="book-genre"><span class="book-genre__dot book-genre__dot--${cfg.color}"></span>${genre}</span>`;
}

export function BookCover({ book, size = 'md' }) {
  return `
    <div class="book-cover book-cover--${book.coverColor} book-cover--${size}">
      <span class="book-cover__initial">${book.title.charAt(0).toUpperCase()}</span>
      ${book.favorite ? `<span class="book-cover__fav">${icon('star', { size: 13 })}</span>` : ''}
    </div>`;
}

// ---- BookCard \u2014 the grid card. Same status-adaptive-face decision noted
// in BUILD_LOG: rather than 4 separate page layouts (Currently Reading /
// Want to Read / Completed / Favorites, as the spec listed them), one card
// component changes its own primary row based on `status`, and status
// itself is a filter facet like everywhere else in this app. ----
function primaryRowForStatus(book) {
  if (book.status === 'Currently Reading' || book.status === 'Re-reading') {
    const progress = computeProgress(book);
    return `
      <div class="book-card__progress">
        ${ProgressRing({ percentage: progress, color: GENRE_CONFIG[book.genres[0]]?.color || 'slate', size: 34, showValue: true })}
        <span class="book-card__progress-label">Page ${book.currentPage} of ${book.totalPages}</span>
      </div>`;
  }
  if (book.status === 'Want to Read') {
    return `<div class="book-card__meta-row"><span>${book.totalPages} pages</span><span>Added ${timeAgo(book.dateAdded)}</span></div>`;
  }
  if (book.status === 'Completed') {
    return `<div class="book-card__meta-row">${RatingStars({ value: book.rating || 0, size: 13 })}<span>${book.dateCompleted ? formatDate(book.dateCompleted) : ''}</span></div>`;
  }
  return `<div class="book-card__meta-row"><span>Page ${book.currentPage} of ${book.totalPages}</span></div>`;
}

export function BookCard({ book }) {
  return `
    <article class="book-card" data-id="${book.id}" tabindex="0">
      ${BookCover({ book })}
      <div class="book-card__body">
        <div class="book-card__top">
          <span class="book-card__genre">${book.genres[0] ? GenreBadge({ genre: book.genres[0] }) : ''}</span>
          ${BookActionMenu({ id: book.id, itemLabel: book.title, favorite: book.favorite, archived: book.archived })}
        </div>
        <h3 class="book-card__title">${book.title}</h3>
        <p class="book-card__author">${book.author}</p>
        <div class="book-card__status-row">${BookStatusBadge({ status: book.status })}</div>
        ${primaryRowForStatus(book)}
      </div>
    </article>`;
}

export function BookSkeleton({ count = 8 }) {
  return Array.from(
    { length: count },
    () => `
    <div class="book-card book-card--skeleton" aria-hidden="true">
      <div class="skeleton-block" style="height:120px;border-radius:var(--radius-md) var(--radius-md) 0 0;"></div>
      <div class="book-card__body">
        <div class="skeleton-block skeleton-block--title"></div>
        <div class="skeleton-block skeleton-block--text" style="width:70%"></div>
        <div class="skeleton-block skeleton-block--footer"></div>
      </div>
    </div>`
  ).join('');
}

export function BooksEmptyState({ hasFilters }) {
  return hasFilters
    ? emptyState({ icon: 'search', title: 'No books match', description: 'Try adjusting your filters or search.', size: 'md' })
    : emptyState({ icon: 'book', title: 'Your library is empty', description: 'Add your first book to start tracking it.', size: 'md' });
}

// ---- Quotes / Highlights / Notes / Sessions \u2014 all rendered inside Book
// Detail, not on the grid card ----
export function QuoteCard({ quote }) {
  return `
    <div class="quote-card" data-id="${quote.id}">
      ${icon('quote', { size: 16, className: 'quote-card__mark' })}
      <p class="quote-card__text">${quote.text}</p>
      <div class="quote-card__footer">
        <span class="quote-card__meta">${[quote.chapter, quote.page ? `p. ${quote.page}` : null].filter(Boolean).join(' \u00b7 ')}</span>
        <div class="quote-card__actions">
          <button type="button" class="icon-btn icon-btn--sm" data-action="favorite-quote" data-id="${quote.id}" aria-label="${quote.favorite ? 'Remove from favorites' : 'Favorite this quote'}" aria-pressed="${quote.favorite}">${icon('star', { size: 14 })}</button>
          <button type="button" class="icon-btn icon-btn--sm" data-action="delete-quote" data-id="${quote.id}" aria-label="Delete quote">${icon('trash', { size: 14 })}</button>
        </div>
      </div>
    </div>`;
}

export function HighlightCard({ highlight }) {
  const cfg = HIGHLIGHT_COLOR_CONFIG[highlight.color] || { css: 'yellow' };
  return `
    <div class="highlight-card highlight-card--${cfg.css}" data-id="${highlight.id}">
      <p class="highlight-card__text">${highlight.text}</p>
      ${highlight.note ? `<p class="highlight-card__note">${icon('fileText', { size: 12 })}<span>${highlight.note}</span></p>` : ''}
      <div class="highlight-card__footer">
        <span class="highlight-card__meta">${[highlight.chapter, highlight.page ? `p. ${highlight.page}` : null].filter(Boolean).join(' \u00b7 ')}</span>
        <button type="button" class="icon-btn icon-btn--sm" data-action="delete-highlight" data-id="${highlight.id}" aria-label="Delete highlight">${icon('trash', { size: 14 })}</button>
      </div>
    </div>`;
}

export function BookNoteCard({ note }) {
  return `
    <div class="book-note-card${note.pinned ? ' is-pinned' : ''}" data-id="${note.id}">
      <div class="book-note-card__header">
        <h5>${note.title}</h5>
        <div class="book-note-card__actions">
          <button type="button" class="icon-btn icon-btn--sm" data-action="pin-note" data-id="${note.id}" aria-label="${note.pinned ? 'Unpin note' : 'Pin note'}" aria-pressed="${note.pinned}">${icon('pin', { size: 14 })}</button>
          <button type="button" class="icon-btn icon-btn--sm" data-action="delete-note" data-id="${note.id}" aria-label="Delete note">${icon('trash', { size: 14 })}</button>
        </div>
      </div>
      <p class="book-note-card__text">${note.text}</p>
      <span class="book-note-card__time">${timeAgo(note.updatedAt)}</span>
    </div>`;
}

export function SessionRow({ session }) {
  const pages = Math.max(0, session.endPage - session.startPage);
  const mood = session.mood ? MOOD_CONFIG[session.mood] : null;
  return `
    <div class="session-row" data-id="${session.id}">
      <span class="session-row__date">${formatDate(session.date)}</span>
      <span class="session-row__pages">${pages} page${pages === 1 ? '' : 's'}</span>
      <span class="session-row__duration">${icon('clock', { size: 13 })}${session.durationMinutes}m</span>
      ${mood ? `<span class="session-row__mood" title="${session.mood}">${icon(mood.icon, { size: 13 })}</span>` : '<span></span>'}
      <button type="button" class="icon-btn icon-btn--sm" data-action="delete-session" data-id="${session.id}" aria-label="Delete session">${icon('trash', { size: 13 })}</button>
    </div>`;
}

export function ReviewBlock({ book }) {
  if (!book.review) {
    return `<p class="book-detail-panel__muted">No review yet.</p>`;
  }
  const r = book.review;
  return `
    <div class="review-block">
      <div class="review-block__rating">${RatingStars({ value: book.rating || 0, size: 16 })}</div>
      <p class="review-block__text">${r.text}</p>
      <div class="review-block__grid">
        ${r.pros ? `<div><span class="review-block__label">Pros</span><p>${r.pros}</p></div>` : ''}
        ${r.cons ? `<div><span class="review-block__label">Cons</span><p>${r.cons}</p></div>` : ''}
      </div>
      ${r.favoriteQuote ? `<p class="review-block__favorite-quote">${icon('quote', { size: 13 })}<span>${r.favoriteQuote}</span></p>` : ''}
      ${r.wouldRecommend !== null && r.wouldRecommend !== undefined ? `<p class="review-block__recommend review-block__recommend--${r.wouldRecommend ? 'yes' : 'no'}">${icon(r.wouldRecommend ? 'check' : 'x', { size: 14 })}<span>${r.wouldRecommend ? 'Would recommend' : 'Would not recommend'}</span></p>` : ''}
    </div>`;
}

export function CollectionChip({ collection }) {
  return `<span class="collection-chip"><span class="collection-chip__icon">${icon(collection.icon, { size: 13 })}</span>${collection.name}</span>`;
}

// ---- BookActivityFeed \u2014 own copy rather than a forced shared abstraction
// with GoalActivityFeed: the event `type` vocabularies don't overlap
// (session/quote/highlight/note vs. milestone/status), so a shared version
// would need a union type neither module actually wants (same reasoning
// BookStatusBadge gave for staying separate from GoalStatusBadge). ----
export function BookActivityFeed({ activity }) {
  if (!activity.length) return `<p class="book-activity__empty">No activity yet.</p>`;
  return `
    <div class="book-activity">
      ${activity
        .slice()
        .reverse()
        .map(
          (a) => `
        <div class="book-activity__row">
          <span class="book-activity__dot book-activity__dot--${a.type}"></span>
          <span class="book-activity__message">${a.message}</span>
          <span class="book-activity__time">${timeAgo(a.date)}</span>
        </div>`
        )
        .join('')}
    </div>`;
}
