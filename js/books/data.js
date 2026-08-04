// Atlas — Books canonical data. Same layering as goals/data.js and
// habits/data.js: raw content + the shape helpers generation needs.
// Derived math (progress, forecast, streak, stats) lives in state.js.
//
// Titles/authors below are entirely invented, not real books — deliberately,
// so that invented Quote/Highlight/Note text attached to them never risks
// reading as a fabricated "verbatim" excerpt from an actual copyrighted work.
// See BUILD_LOG for the full reasoning.
//
// Several spec fields don't exist here, same "don't fake what there's no
// real system for" reasoning as every prior module:
// - No separate Author/Collection *pages* with bios/photos — no file
//   storage exists for photos (same reasoning Goals gave for dropping
//   coverImage), and a full author-profile CRUD surface is deferred (§8).
//   Authors are plain strings on each book; `coverColor` (an identity key,
//   same system as Goals/Projects) drives the generated cover instead of a
//   real image.
// - No ISBN/cover-image lookup — no external API exists to call.
// - `BookStatistics`/`ReadingStatistics`/`BookActivity`/`BookTimeline` are
//   NOT stored — all computed live in state.js from sessions/quotes/
//   highlights/notes/status changes, same "derive, don't duplicate"
//   reasoning as Goals' progress cascade.
// - `ReadingGoal` is not a parallel entity — a book links to the real Goals
//   module (`linkedGoalIds`) instead of a second goal system next to it.
// - `targetFinishDate` is a field the spec didn't ask for by that name, but
//   is added anyway: without a per-book deadline there was nothing real for
//   the Calendar "Deadlines" integration to hook into (see repository.js).

import { dateKey, todayDate } from '../date-utils.js';
export { PRIORITY_CONFIG, PRIORITIES } from '../components.js';

/**
 * @typedef {Object} Review
 * @property {string} text
 * @property {string} pros
 * @property {string} cons
 * @property {boolean|null} wouldRecommend
 * @property {string} favoriteQuote
 */

/**
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} title
 * @property {string|null} subtitle
 * @property {string} author
 * @property {string} coverColor        - identity color key, drives the generated cover (no real cover images)
 * @property {string} description
 * @property {string|null} publisher
 * @property {string|null} publicationYear
 * @property {string|null} isbn
 * @property {string} language
 * @property {number} totalPages
 * @property {string[]} genres          - GENRE_CONFIG keys
 * @property {string[]} tags
 * @property {string} status            - a STATUS_CONFIG key
 * @property {number|null} rating        - 0\u20135 in 0.5 steps
 * @property {boolean} favorite
 * @property {boolean} archived
 * @property {string} dateAdded
 * @property {string|null} dateStarted
 * @property {string|null} dateCompleted
 * @property {string|null} targetFinishDate
 * @property {number} currentPage
 * @property {string|null} lastOpened
 * @property {Review|null} review
 * @property {string[]} linkedGoalIds    - real Goals module ids
 * @property {string[]} linkedProjectIds - real Projects module ids
 * @property {string[]} linkedHabitIds   - real Habits module ids
 * @property {string} notes             - scratch notes on the book itself, same role as Goal.notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ReadingSession
 * @property {string} id
 * @property {string} bookId
 * @property {string} date         - 'YYYY-MM-DD'
 * @property {string|null} startTime - 'HH:MM'
 * @property {string|null} endTime
 * @property {number} durationMinutes
 * @property {number} startPage
 * @property {number} endPage
 * @property {string|null} mood    - a MOOD_CONFIG key
 * @property {string} notes
 */

/**
 * @typedef {Object} Quote
 * @property {string} id
 * @property {string} bookId
 * @property {number|null} page
 * @property {string|null} chapter
 * @property {string} text
 * @property {string[]} tags
 * @property {boolean} favorite
 * @property {string} dateAdded
 */

/**
 * @typedef {Object} Highlight
 * @property {string} id
 * @property {string} bookId
 * @property {number|null} page
 * @property {string|null} chapter
 * @property {string} text
 * @property {string} color        - a HIGHLIGHT_COLOR_CONFIG key
 * @property {string} note
 * @property {string[]} tags
 * @property {string} dateAdded
 */

/**
 * @typedef {Object} BookNote
 * @property {string} id
 * @property {string} bookId
 * @property {string} title
 * @property {string} text          - plain text in this milestone; see BUILD_LOG \u00a78 on reusing the real Notes editor later
 * @property {string[]} tags
 * @property {boolean} pinned
 * @property {string} dateAdded
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Collection
 * @property {string} id
 * @property {string} name
 * @property {string} icon          - emoji, same convention as goals/data.js and projects/data.js
 * @property {string} coverColor
 * @property {string[]} bookIds
 * @property {string} createdAt
 */

export const STATUS_CONFIG = {
  'Currently Reading': { color: 'accent' },
  'Want to Read': { color: 'neutral' },
  Completed: { color: 'success' },
  Paused: { color: 'warning' },
  Dropped: { color: 'danger' },
  'Re-reading': { color: 'planning' },
  Archived: { color: 'archived' },
};
export const STATUSES = Object.keys(STATUS_CONFIG);

export const GENRE_CONFIG = {
  Programming: { color: 'blue' },
  'Computer Science': { color: 'blue' },
  AI: { color: 'violet' },
  Fantasy: { color: 'violet' },
  'Science Fiction': { color: 'teal' },
  Mystery: { color: 'slate' },
  Romance: { color: 'rose' },
  Biography: { color: 'amber' },
  History: { color: 'amber' },
  Business: { color: 'emerald' },
  Finance: { color: 'emerald' },
  Psychology: { color: 'rose' },
  Mathematics: { color: 'blue' },
  Productivity: { color: 'teal' },
  'Self Help': { color: 'rose' },
  Health: { color: 'emerald' },
  Technology: { color: 'blue' },
  Philosophy: { color: 'slate' },
  Education: { color: 'teal' },
};
export const GENRES = Object.keys(GENRE_CONFIG);

// Six named colors, matching the spec exactly. Five reuse the app's existing
// 7 identity colors (Blue/Green\u2192emerald/Pink\u2192rose/Purple\u2192violet/
// Orange\u2192amber); Yellow needed the one new token added to tokens.css
// this milestone (see BUILD_LOG \u00a73) since none of the 7 was a true yellow.
export const HIGHLIGHT_COLOR_CONFIG = {
  Yellow: { css: 'yellow' },
  Green: { css: 'emerald' },
  Blue: { css: 'blue' },
  Pink: { css: 'rose' },
  Purple: { css: 'violet' },
  Orange: { css: 'amber' },
};
export const HIGHLIGHT_COLORS = Object.keys(HIGHLIGHT_COLOR_CONFIG);

export const MOOD_CONFIG = {
  Great: { icon: 'sparkle' },
  Good: { icon: 'check' },
  Neutral: { icon: 'compass' },
  Distracted: { icon: 'x' },
  Tired: { icon: 'moon' },
};
export const MOODS = Object.keys(MOOD_CONFIG);

export const BOOK_COLORS = ['blue', 'violet', 'teal', 'amber', 'rose', 'emerald', 'slate'];

function daysAgo(n) {
  const d = todayDate();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}
function daysAhead(n) {
  return daysAgo(-n);
}

// ---- Seed books (24 \u2014 a smaller, stated stand-in for the spec's "minimum
// 60"; see BUILD_LOG for why, same reasoning as Goals' 16-for-40). Titles
// and authors are invented (see file header). `sessionProfile` feeds
// generateSessions() below; books that were never opened (Want to Read)
// simply have no profile and get zero generated sessions. ----
const seedBooks = [
  { id: 'b1', title: 'The Compound Effect Mindset', author: 'Elena Marsh', coverColor: 'emerald', description: 'A field guide to small, repeatable habits that compound into outsized results.', publisher: 'Northfield Press', publicationYear: '2022', isbn: '978-1-40000-101-1', totalPages: 288, genres: ['Business', 'Productivity'], tags: ['Productivity'], status: 'Currently Reading', rating: null, favorite: true, dateAdded: daysAgo(20), dateStarted: daysAgo(18), dateCompleted: null, targetFinishDate: null, currentPage: 154, lastOpened: daysAgo(1), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: ['h2'], sessionProfile: { seed: 401, span: 18, count: 9 } },
  { id: 'b2', title: 'Shards of the Fractured Crown', author: 'Corwin Blake', coverColor: 'violet', description: 'The second Ashvale book \u2014 a fractured kingdom, three claimants, one crown that chooses badly.', publisher: 'Wren & Moth', publicationYear: '2021', isbn: '978-1-40000-102-8', totalPages: 512, genres: ['Fantasy'], tags: ['Fantasy', 'Series'], status: 'Currently Reading', rating: null, favorite: false, dateAdded: daysAgo(11), dateStarted: daysAgo(9), dateCompleted: null, targetFinishDate: daysAhead(20), currentPage: 340, lastOpened: daysAgo(2), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 402, span: 9, count: 7 } },
  { id: 'b3', title: 'Mind Over Noise', author: 'Dr. Priya Nandy', coverColor: 'rose', description: 'A psychologist\u2019s framework for filtering signal from anxiety in an over-notified life.', publisher: 'Harborview Books', publicationYear: '2023', isbn: '978-1-40000-103-5', totalPages: 240, genres: ['Psychology', 'Health'], tags: ['Wellness'], status: 'Currently Reading', rating: null, favorite: false, dateAdded: daysAgo(4), dateStarted: daysAgo(3), dateCompleted: null, targetFinishDate: null, currentPage: 40, lastOpened: daysAgo(0), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 403, span: 3, count: 3 } },
  { id: 'b4', title: 'Neural Horizons: An AI Primer', author: 'Marcus Yuen', coverColor: 'blue', description: 'A practitioner\u2019s tour of modern machine learning, from gradients to transformers.', publisher: 'Alderbrook Technical', publicationYear: '2024', isbn: '978-1-40000-104-2', totalPages: 380, genres: ['Computer Science', 'AI'], tags: ['University', 'Coding'], status: 'Currently Reading', rating: null, favorite: true, dateAdded: daysAgo(30), dateStarted: daysAgo(27), dateCompleted: null, targetFinishDate: daysAhead(10), currentPage: 210, lastOpened: daysAgo(1), linkedGoalIds: ['g13'], linkedProjectIds: [], linkedHabitIds: ['h5'], sessionProfile: { seed: 404, span: 27, count: 12 } },

  { id: 'b5', title: 'The Quiet Ledger', author: 'Sofia Alvarez', coverColor: 'slate', description: 'A forensic accountant finds a decades-old fraud with her own name buried in it.', publisher: 'Cutwater House', publicationYear: '2020', isbn: '978-1-40000-105-9', totalPages: 320, genres: ['Mystery'], tags: [], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(40), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b6', title: 'Beyond the Rilan Expanse', author: 'Thaddeus Wren', coverColor: 'teal', description: 'A generation ship\u2019s last crew discovers the expanse they were fleeing was never empty.', publisher: 'Farline Books', publicationYear: '2019', isbn: '978-1-40000-106-6', totalPages: 448, genres: ['Science Fiction'], tags: [], status: 'Want to Read', rating: null, favorite: true, dateAdded: daysAgo(12), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b7', title: 'The Salt Road', author: 'Renata Kessler', coverColor: 'amber', description: 'A history of the overland trade routes that moved salt, silk, and rumor across three empires.', publisher: 'Meridian Historical', publicationYear: '2018', isbn: '978-1-40000-107-3', totalPages: 400, genres: ['History'], tags: [], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(60), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b8', title: 'Small Wins, Repeated', author: 'James Okafor', coverColor: 'rose', description: 'Why tiny, boring, repeatable actions beat ambitious plans that never survive week two.', publisher: 'Northfield Press', publicationYear: '2023', isbn: '978-1-40000-108-0', totalPages: 256, genres: ['Self Help', 'Productivity'], tags: ['Productivity'], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(5), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b9', title: 'Sit With It', author: 'Liu Wei', coverColor: 'slate', description: 'Short essays on discomfort, patience, and the philosophy of not immediately reacting.', publisher: 'Cinder & Ash', publicationYear: '2021', isbn: '978-1-40000-109-7', totalPages: 210, genres: ['Philosophy'], tags: ['Wellness', 'Mindfulness'], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(25), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b10', title: 'After the Orchard', author: 'Grace Ferreira', coverColor: 'rose', description: 'Two sisters inherit their grandmother\u2019s orchard and the argument they never finished.', publisher: 'Marlow & Finch', publicationYear: '2022', isbn: '978-1-40000-110-3', totalPages: 336, genres: ['Romance'], tags: [], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(70), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b11', title: 'Foundations of Discrete Structures', author: 'Dr. Amos Whitfield', coverColor: 'blue', description: 'A rigorous, example-driven introduction to logic, sets, graphs, and proof technique.', publisher: 'Alderbrook Technical', publicationYear: '2020', isbn: '978-1-40000-111-0', totalPages: 460, genres: ['Mathematics', 'Computer Science'], tags: ['University'], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(2), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: ['g13'], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },
  { id: 'b12', title: 'The Long Correction', author: 'Nadia Petrova', coverColor: 'amber', description: 'The biography of a market analyst who called two crashes and was ruined by a third.', publisher: 'Cutwater House', publicationYear: '2017', isbn: '978-1-40000-112-7', totalPages: 384, genres: ['Biography'], tags: [], status: 'Want to Read', rating: null, favorite: false, dateAdded: daysAgo(15), dateStarted: null, dateCompleted: null, targetFinishDate: null, currentPage: 0, lastOpened: null, linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: null },

  { id: 'b13', title: 'Atomic Focus', author: 'Elena Marsh', coverColor: 'emerald', description: 'Elena Marsh\u2019s first book \u2014 attention as the actual scarce resource, not time.', publisher: 'Northfield Press', publicationYear: '2020', isbn: '978-1-40000-113-4', totalPages: 288, genres: ['Business'], tags: ['Productivity'], status: 'Completed', rating: 4.5, favorite: true, dateAdded: daysAgo(60), dateStarted: daysAgo(55), dateCompleted: daysAgo(40), targetFinishDate: null, currentPage: 288, lastOpened: daysAgo(40), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: ['h2'], sessionProfile: { seed: 413, span: 15, count: 8 },
    review: { text: 'Reframed attention (not time) as the resource I actually manage badly. The chapter on "recovery debt" alone was worth the read.', pros: 'Short chapters, concrete drills, no filler.', cons: 'Repeats its core idea more than it needs to past chapter 6.', wouldRecommend: true, favoriteQuote: 'You don\u2019t rise to your goals, you fall to the last system you actually maintained.' } },
  { id: 'b14', title: 'The Winter Accord', author: 'Corwin Blake', coverColor: 'violet', description: 'The first Ashvale book \u2014 a truce signed in bad faith, and the two soldiers who have to enforce it anyway.', publisher: 'Wren & Moth', publicationYear: '2019', isbn: '978-1-40000-114-1', totalPages: 480, genres: ['Fantasy'], tags: ['Fantasy', 'Series'], status: 'Completed', rating: 5, favorite: true, dateAdded: daysAgo(120), dateStarted: daysAgo(110), dateCompleted: daysAgo(90), targetFinishDate: null, currentPage: 480, lastOpened: daysAgo(6), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 414, span: 20, count: 10 },
    review: { text: 'Everything I want from political fantasy \u2014 nobody in this book is simply right, including the two people the plot is rooting for.', pros: 'The two-POV structure earns its ending.', cons: 'The middle third slows for a subplot that only pays off in book two.', wouldRecommend: true, favoriteQuote: 'A truce is just a war both sides agreed to lose slowly.' } },
  { id: 'b15', title: 'Deep Systems Design', author: 'Marcus Yuen', coverColor: 'blue', description: 'Designing software systems that stay legible at 10x the team size and 100x the load.', publisher: 'Alderbrook Technical', publicationYear: '2023', isbn: '978-1-40000-115-8', totalPages: 350, genres: ['Computer Science', 'Technology'], tags: ['Engineering'], status: 'Completed', rating: 4, favorite: false, dateAdded: daysAgo(40), dateStarted: daysAgo(35), dateCompleted: daysAgo(20), targetFinishDate: null, currentPage: 350, lastOpened: daysAgo(20), linkedGoalIds: ['g1'], linkedProjectIds: ['p2'], linkedHabitIds: [], sessionProfile: { seed: 415, span: 15, count: 9 },
    review: { text: 'The clearest explanation I\u2019ve read of why the "right" architecture depends entirely on which axis is actually under load.', pros: 'Real, named trade-offs instead of one-true-way advice.', cons: 'Assumes you\u2019ve already shipped at least one production system.', wouldRecommend: true, favoriteQuote: 'Every architecture is a bet on which part of the system will change next.' } },
  { id: 'b16', title: 'Calm the Static', author: 'Dr. Priya Nandy', coverColor: 'rose', description: 'Dr. Nandy\u2019s earlier book \u2014 a shorter, gentler entry point to the same filtering framework.', publisher: 'Harborview Books', publicationYear: '2019', isbn: '978-1-40000-116-5', totalPages: 220, genres: ['Health', 'Psychology'], tags: ['Wellness'], status: 'Completed', rating: 3.5, favorite: false, dateAdded: daysAgo(150), dateStarted: daysAgo(140), dateCompleted: daysAgo(130), targetFinishDate: null, currentPage: 220, lastOpened: daysAgo(130), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 416, span: 10, count: 6 },
    review: { text: 'Solid and short, but "Mind Over Noise" is the fuller version of the same argument \u2014 read that one first if you only have time for one.', pros: 'Fast to finish, good as a refresher.', cons: 'Thin on evidence compared to her later book.', wouldRecommend: false, favoriteQuote: 'Noise doesn\u2019t need to be answered. It needs to be outlasted.' } },
  { id: 'b17', title: 'The Cartographer\u2019s Daughter', author: 'Sofia Alvarez', coverColor: 'slate', description: 'A map-maker\u2019s daughter finds a city on her father\u2019s charts that isn\u2019t on anyone else\u2019s.', publisher: 'Cutwater House', publicationYear: '2018', isbn: '978-1-40000-117-2', totalPages: 300, genres: ['Mystery'], tags: [], status: 'Completed', rating: 4, favorite: false, dateAdded: daysAgo(220), dateStarted: daysAgo(210), dateCompleted: daysAgo(200), targetFinishDate: null, currentPage: 300, lastOpened: daysAgo(200), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 417, span: 10, count: 6 },
    review: { text: 'The reveal is earned \u2014 every clue was genuinely on the page from chapter two, which is rarer than it should be in this genre.', pros: 'Fair-play mystery, tight pacing.', cons: 'The romantic subplot feels bolted on.', wouldRecommend: true, favoriteQuote: 'Every map is a story about what the mapmaker was afraid to leave out.' } },
  { id: 'b18', title: 'Orbit of Small Things', author: 'Thaddeus Wren', coverColor: 'teal', description: 'A station engineer keeps a dying colony alive one small, unglamorous repair at a time.', publisher: 'Farline Books', publicationYear: '2017', isbn: '978-1-40000-118-9', totalPages: 410, genres: ['Science Fiction'], tags: [], status: 'Completed', rating: 4.5, favorite: true, dateAdded: daysAgo(270), dateStarted: daysAgo(260), dateCompleted: daysAgo(250), targetFinishDate: null, currentPage: 410, lastOpened: daysAgo(250), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 418, span: 10, count: 7 },
    review: { text: 'Low-key, unhurried, and the best kind of hopeful \u2014 the ending is a repaired air scrubber, not a battle.', pros: 'Genuinely different pace for the genre.', cons: 'The final act slows almost too much.', wouldRecommend: true, favoriteQuote: 'The ship didn\u2019t need a hero. It needed someone to show up on Tuesday.' } },
  { id: 'b22', title: 'The Actuary\u2019s Daughter', author: 'Nadia Petrova', coverColor: 'amber', description: 'The biography of an early actuary who priced risk for a company that refused to believe in it.', publisher: 'Cutwater House', publicationYear: '2015', isbn: '978-1-40000-122-4', totalPages: 340, genres: ['Biography'], tags: [], status: 'Completed', rating: 3, favorite: false, dateAdded: daysAgo(420), dateStarted: daysAgo(410), dateCompleted: daysAgo(400), targetFinishDate: null, currentPage: 340, lastOpened: daysAgo(400), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 422, span: 10, count: 5 },
    review: { text: 'Admirable research, but the middle third is a ledger with footnotes \u2014 informative rather than compelling.', pros: 'Meticulously sourced.', cons: 'Pacing sags for a full third of the book.', wouldRecommend: false, favoriteQuote: 'Risk doesn\u2019t announce itself. It just quietly stops being rare.' } },
  { id: 'b23', title: 'Say It in Fewer Words', author: 'James Okafor', coverColor: 'rose', description: 'A short, blunt case for cutting every sentence, email, and slide deck in half.', publisher: 'Northfield Press', publicationYear: '2024', isbn: '978-1-40000-123-1', totalPages: 200, genres: ['Self Help'], tags: ['Productivity'], status: 'Completed', rating: 4, favorite: false, dateAdded: daysAgo(20), dateStarted: daysAgo(18), dateCompleted: daysAgo(15), targetFinishDate: null, currentPage: 200, lastOpened: daysAgo(15), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 423, span: 3, count: 4 },
    review: { text: 'Practices what it preaches \u2014 200 pages that could have been 350 anywhere else, and I mean that as the highest compliment.', pros: 'No padding, immediately usable.', cons: 'A little repetitive on the "cut it in half" refrain by the end.', wouldRecommend: true, favoriteQuote: 'If it needs a second sentence to explain the first one, delete the first one.' } },

  { id: 'b19', title: 'Kingdoms of Ash and Order', author: 'Corwin Blake', coverColor: 'violet', description: 'A standalone Ashvale-world prequel \u2014 the war that made the Winter Accord necessary in the first place.', publisher: 'Wren & Moth', publicationYear: '2016', isbn: '978-1-40000-119-6', totalPages: 528, genres: ['Fantasy'], tags: ['Fantasy'], status: 'Paused', rating: null, favorite: false, dateAdded: daysAgo(210), dateStarted: daysAgo(200), dateCompleted: null, targetFinishDate: null, currentPage: 120, lastOpened: daysAgo(185), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 419, span: 15, count: 4 } },
  { id: 'b20', title: 'The Discipline of Small Rooms', author: 'James Okafor', coverColor: 'rose', description: 'A minimalist\u2019s argument that a smaller footprint \u2014 physical and digital \u2014 clears more than clutter.', publisher: 'Northfield Press', publicationYear: '2021', isbn: '978-1-40000-120-2', totalPages: 260, genres: ['Productivity', 'Self Help'], tags: ['Productivity'], status: 'Dropped', rating: null, favorite: false, dateAdded: daysAgo(190), dateStarted: daysAgo(180), dateCompleted: null, targetFinishDate: null, currentPage: 45, lastOpened: daysAgo(175), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], sessionProfile: { seed: 420, span: 5, count: 2 } },
  { id: 'b21', title: 'Letters to a Younger Mind', author: 'Liu Wei', coverColor: 'slate', description: 'Essays written as letters to the author\u2019s own younger self, on patience and being wrong in public.', publisher: 'Cinder & Ash', publicationYear: '2020', isbn: '978-1-40000-121-9', totalPages: 190, genres: ['Philosophy', 'Education'], tags: ['Wellness'], status: 'Re-reading', rating: 5, favorite: true, dateAdded: daysAgo(310), dateStarted: daysAgo(6), dateCompleted: daysAgo(300), targetFinishDate: null, currentPage: 90, lastOpened: daysAgo(0), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: ['h4'], sessionProfile: { seed: 421, span: 6, count: 4 },
    review: { text: 'The one book I come back to \u2014 short enough to reread in a weekend, and it says something different each time.', pros: 'Reread-proof; ages with you.', cons: 'A few essays lean aphoristic to the point of vagueness.', wouldRecommend: true, favoriteQuote: 'Being wrong in public is just being early in a way nobody thanked you for yet.' } },

  { id: 'b24', title: 'The Unread Shelf', author: 'Grace Ferreira', coverColor: 'rose', description: 'A romance set inside a secondhand bookshop that\u2019s closing at the end of the month.', publisher: 'Marlow & Finch', publicationYear: '2016', isbn: '978-1-40000-124-8', totalPages: 300, genres: ['Romance'], tags: [], status: 'Archived', rating: null, favorite: false, dateAdded: daysAgo(500), dateStarted: daysAgo(490), dateCompleted: null, targetFinishDate: null, currentPage: 10, lastOpened: daysAgo(485), linkedGoalIds: [], linkedProjectIds: [], linkedHabitIds: [], archivedFlag: true, sessionProfile: { seed: 424, span: 3, count: 1 } },
];

// ---- Deterministic generation (see habits/data.js and goals/data.js for
// the same technique) ----
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const START_HOUR_POOL = ['06:30', '07:15', '12:30', '13:00', '17:30', '19:00', '20:00', '21:15', '22:00'];

function generateSessions(book, profile) {
  if (!profile) return [];
  const rand = seededRandom(profile.seed);
  const sessions = [];
  const totalPagesRead = book.currentPage;
  if (totalPagesRead <= 0) return [];

  // Pick `count` distinct day-offsets across the span, oldest first, and
  // distribute pages read across them with a little noise so the running
  // total lands exactly on the book's own currentPage \u2014 forced, not hoped
  // for, same reasoning as Habits' tailStreakDays forcing a clean streak.
  const span = Math.max(profile.span, profile.count);
  const offsets = new Set();
  while (offsets.size < Math.min(profile.count, span)) {
    offsets.add(Math.floor(rand() * span));
  }
  const sortedOffsets = [...offsets].sort((a, b) => b - a); // largest offset = oldest day first

  let pagesRemaining = totalPagesRead;
  let startPageCursor = 0;
  sortedOffsets.forEach((offsetDays, idx) => {
    const isLast = idx === sortedOffsets.length - 1;
    const share = isLast ? pagesRemaining : Math.max(5, Math.round((pagesRemaining / (sortedOffsets.length - idx)) * (0.7 + rand() * 0.6)));
    const pagesRead = Math.min(pagesRemaining, share);
    const startPage = startPageCursor;
    const endPage = startPage + pagesRead;
    const startTime = START_HOUR_POOL[Math.floor(rand() * START_HOUR_POOL.length)];
    const durationMinutes = Math.max(10, Math.round(pagesRead * (1.2 + rand() * 1.3)));
    const [h, m] = startTime.split(':').map(Number);
    const endTotal = h * 60 + m + durationMinutes;
    const endTime = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
    const date = daysAgo(offsetDays);
    sessions.push({
      id: `rs-${book.id}-${idx}`, bookId: book.id, date, startTime, endTime, durationMinutes,
      startPage, endPage, mood: MOODS[Math.floor(rand() * MOODS.length)], notes: '',
    });
    pagesRemaining -= pagesRead;
    startPageCursor = endPage;
  });
  return sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const books = seedBooks.map((b) => {
  const { sessionProfile, archivedFlag, review, ...rest } = b;
  return {
    ...rest,
    subtitle: null, notes: '', archived: Boolean(archivedFlag),
    review: review || null,
    createdAt: rest.dateAdded, updatedAt: rest.lastOpened || rest.dateAdded,
  };
});

export const sessions = seedBooks.flatMap((b) => generateSessions(books.find((bk) => bk.id === b.id), b.sessionProfile));

// ---- Quotes / Highlights / Notes \u2014 generated for any book with real
// progress (you can't highlight a page you haven't read), from small
// theme-flavored pools rather than one global pool, so they at least read
// as loosely on-topic for the book they're attached to. ----
const QUOTE_POOL = {
  Business: ['The plan survives contact with Monday about as well as any other plan.', 'Discipline is just motivation that already left the building.', 'Every system is three good weeks away from looking like talent.'],
  Fantasy: ['No crown fits the head that only wanted the weight off someone else\u2019s.', 'The map was accurate. The land had simply stopped listening to it.', 'Every truce is a war both sides agreed to lose slowly.'],
  'Science Fiction': ['The ship didn\u2019t need a hero. It needed someone to show up on Tuesday.', 'Distance is just time that hasn\u2019t caught up with you yet.', 'Every generation ship carries one more passenger than the manifest says: the reason it left.'],
  Mystery: ['Every map is a story about what the mapmaker was afraid to leave out.', 'The truth doesn\u2019t hide. It just waits for someone to stop being polite.', 'A good alibi only needs to survive one honest question.'],
  Psychology: ['Noise doesn\u2019t need to be answered. It needs to be outlasted.', 'Anxiety is just attention with nowhere assigned to land.', 'You can\u2019t think your way out of a room you\u2019re still standing in.'],
  'Computer Science': ['Every architecture is a bet on which part of the system will change next.', 'Complexity doesn\u2019t announce itself. It just quietly stops being optional.', 'The bug was never in the code. It was in what everyone agreed not to check.'],
  Philosophy: ['Being wrong in public is just being early in a way nobody thanked you for yet.', 'Patience is not waiting. It is the refusal to negotiate with the clock.', 'Sit with it long enough and it stops being a feeling and starts being information.'],
  Romance: ['Some rooms only ever had one door, and you both used to know that.', 'She kept the argument the way other people keep letters.', 'A shop this small only ever has room for one unfinished conversation at a time.'],
  Biography: ['Risk doesn\u2019t announce itself. It just quietly stops being rare.', 'He priced the future for a living and still didn\u2019t see his own coming.', 'A ledger remembers everything except the reason anyone believed it.'],
  History: ['Every trade route is a rumor that found a shorter way to travel.', 'Empires don\u2019t fall. They just stop being the fastest way to move salt.'],
  'Self Help': ['If it needs a second sentence to explain the first one, delete the first one.', 'Small wins don\u2019t compound because they\u2019re small. They compound because they\u2019re repeated.'],
};
function poolFor(book) {
  for (const g of book.genres) if (QUOTE_POOL[g]) return QUOTE_POOL[g];
  return QUOTE_POOL['Self Help'];
}

function generateExtras(book, seed) {
  const rand = seededRandom(seed);
  const pool = poolFor(book);
  const readPages = book.currentPage || 0;
  if (readPages <= 0) return { quotes: [], highlights: [], notes: [] };

  const quotes = [];
  const qCount = Math.min(pool.length, 1 + Math.floor(rand() * 3));
  for (let i = 0; i < qCount; i += 1) {
    quotes.push({
      id: `q-${book.id}-${i}`, bookId: book.id, page: Math.max(1, Math.floor(rand() * readPages)),
      chapter: `Ch. ${1 + Math.floor(rand() * 12)}`, text: pool[i % pool.length],
      tags: book.genres.slice(0, 1), favorite: rand() > 0.75, dateAdded: daysAgo(Math.floor(rand() * 30)),
    });
  }

  const highlights = [];
  const hCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < hCount; i += 1) {
    highlights.push({
      id: `hl-${book.id}-${i}`, bookId: book.id, page: Math.max(1, Math.floor(rand() * readPages)),
      chapter: `Ch. ${1 + Math.floor(rand() * 12)}`, text: pool[(i + 1) % pool.length],
      color: HIGHLIGHT_COLORS[Math.floor(rand() * HIGHLIGHT_COLORS.length)],
      note: rand() > 0.6 ? 'Worth revisiting before the next session.' : '',
      tags: [], dateAdded: daysAgo(Math.floor(rand() * 30)),
    });
  }

  const notes = [];
  if (rand() > 0.45) {
    notes.push({
      id: `bn-${book.id}-0`, bookId: book.id, title: 'First impressions',
      text: `Slower start than expected, picks up once ${book.author.split(' ').slice(-1)[0]} gets past the setup.`,
      tags: [], pinned: rand() > 0.7, dateAdded: daysAgo(Math.floor(rand() * 30)), updatedAt: daysAgo(Math.floor(rand() * 10)),
    });
  }
  if (book.status === 'Completed' && rand() > 0.5) {
    notes.push({
      id: `bn-${book.id}-1`, bookId: book.id, title: 'Would recommend to',
      text: 'Anyone who liked the pacing more than the ending \u2014 flag this before lending it out.',
      tags: [], pinned: false, dateAdded: book.dateCompleted || daysAgo(1), updatedAt: book.dateCompleted || daysAgo(1),
    });
  }
  return { quotes, highlights, notes };
}

const extrasByBook = seedBooks.map((b, idx) => generateExtras(books.find((bk) => bk.id === b.id), 500 + idx));
export const quotes = extrasByBook.flatMap((e) => e.quotes);
export const highlights = extrasByBook.flatMap((e) => e.highlights);
export const bookNotes = extrasByBook.flatMap((e) => e.notes);

// ---- Collections (6) \u2014 basic grouping; full standalone management UI
// deferred (\u00a78) but the data + a simple add/remove-from-collection action
// on Book Detail are real this milestone. ----
export const collections = [
  { id: 'c1', name: 'Favorites', icon: 'star', coverColor: 'amber', bookIds: books.filter((b) => b.favorite).map((b) => b.id), createdAt: daysAgo(300) },
  { id: 'c2', name: 'University', icon: 'bookOpen', coverColor: 'blue', bookIds: ['b4', 'b11', 'b15'], createdAt: daysAgo(90) },
  { id: 'c3', name: 'Ashvale Series', icon: 'layers', coverColor: 'violet', bookIds: ['b14', 'b2', 'b19'], createdAt: daysAgo(120) },
  { id: 'c4', name: '2026 Reads', icon: 'calendar', coverColor: 'teal', bookIds: books.filter((b) => b.dateAdded >= '2026-01-01').map((b) => b.id), createdAt: daysAgo(200) },
  { id: 'c5', name: 'Weekend Reads', icon: 'sparkle', coverColor: 'rose', bookIds: ['b8', 'b23', 'b9'], createdAt: daysAgo(60) },
  { id: 'c6', name: 'Top Rated', icon: 'trophy', coverColor: 'emerald', bookIds: books.filter((b) => (b.rating || 0) >= 4.5).map((b) => b.id), createdAt: daysAgo(30) },
];

export function bookById(id) {
  return books.find((b) => b.id === id) || null;
}
export const ALL_BOOK_TAGS = [...new Set(books.flatMap((b) => b.tags))].sort();
