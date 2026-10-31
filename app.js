const maxRenderedRows = 15;
const minimumSearchLength = 1;
const fuzzyResultLimit = 80;
const requestSongUrl = "https://overlandbar.com/request-a-song";
const songIndexUrl = "songs.index.json?v=20260604-artist-aliases";
const songCsvUrl = "songs.csv?v=20260604-artist-aliases";
const themeDaysUrl = "theme_days.csv?v=20260604-artist-aliases";

const searchForm = document.querySelector("#song-search-form");
const searchInput = document.querySelector("#song-search");
const clearButton = document.querySelector("#clear-search");
const searchControls = document.querySelector("#search-controls");
const resultsTitle = document.querySelector("#results-title");
const catalogStatus = document.querySelector("#catalog-status");
const retrySongsButton = document.querySelector("#retry-songs");
const filterDetails = document.querySelector("#filter-details");
const filterTotal = document.querySelector("#filter-total");
const navToggle = document.querySelector("#nav-toggle");
const siteNav = document.querySelector("#site-nav");
let browseButtons = document.querySelectorAll(".browse-button");
const filterCategoryButtons = document.querySelectorAll(".filter-category-button");
const filterGroups = document.querySelectorAll("[data-filter-group]");
const clearFiltersButton = document.querySelector("#clear-filters");
const browseAllButton = document.querySelector("#browse-all");
const jumpResultsButton = document.querySelector("#jump-results");
const filterSummary = document.querySelector("#filter-summary");
const genreButtons = document.querySelector("#genre-buttons");
const subgenrePanel = document.querySelector("#subgenre-panel");
const subgenreButtons = document.querySelector("#subgenre-buttons");
const resultsSection = document.querySelector("#results-section");
const resultsBody = document.querySelector("#song-results");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const loadMoreButton = document.querySelector("#load-more-results");
const similarPanel = document.querySelector("#similar-panel");
const similarBody = document.querySelector("#similar-results");
const similarTitle = document.querySelector("#similar-title");
const dicePanel = document.querySelector("#dice-panel");
const topDiceButton = document.querySelector("#top-dice-button");
const diceButton = document.querySelector("#dice-button");
const diceCloseButtons = document.querySelectorAll("[data-dice-close]");
const diceResults = document.querySelector("#dice-results");
const diceFemaleResults = document.querySelector("#dice-female-results");
const diceMaleResults = document.querySelector("#dice-male-results");
const diceDuetResults = document.querySelector("#dice-duet-results");
const diceGroupResults = document.querySelector("#dice-group-results");
const themeSection = document.querySelector("#theme-section");
const themeKicker = document.querySelector("#theme-kicker");
const themeTitle = document.querySelector("#theme-title");
const themeDate = document.querySelector("#theme-date");
const themeDescription = document.querySelector("#theme-description");
const themeButton = document.querySelector("#theme-button");
const themeClearButton = document.querySelector("#theme-clear-button");
const themeLabelPanel = document.querySelector("#theme-label-panel");
const themeLabelButtons = document.querySelector("#theme-label-buttons");
const upcomingThemes = document.querySelector("#upcoming-themes");
const upcomingThemeList = document.querySelector("#upcoming-theme-list");
const topSongsPanel = document.querySelector("#top-songs-panel");
const topSongsBody = document.querySelector("#top-songs-results");
const popularBand = document.querySelector(".popular-band");
const returnSearchButton = document.querySelector("#return-search");
const songDialog = document.querySelector("#song-dialog");
const songDialogTitle = document.querySelector("#song-dialog-title");
const songDialogArtist = document.querySelector("#song-dialog-artist");
const songDialogMeta = document.querySelector("#song-dialog-meta");

let songs = [];
let searchTimer = 0;
let analyticsSearchTimer = 0;
let lastTrackedSearch = null;
let requestNavigationStarted = false;
let activeFilters = [];
let activeFilterSection = "vocal";
let visibleGenreCount = 10;
let visibleSubgenreCount = 10;
let currentSearchMatches = [];
let currentSearchQuery = "";
let visibleResultCount = maxRenderedRows;
let currentUsedTypoMatching = false;
let themesLoaded = [];
let isBrowseAllActive = false;
let lastResultSignature = "";
let lastDialogTrigger = null;
let hasRolledDice = false;
let catalogState = "loading";
let pendingResultsJump = false;
let resultsJumpTimer = 0;

if (filterDetails) {
  filterDetails.open = window.matchMedia("(min-width: 980px)").matches;
}

const diceButtons = [topDiceButton, diceButton].filter(Boolean);
diceButtons.forEach((button) => {
  button.disabled = true;
});

function updateHeaderScrollState() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 4);
  updateReturnSearchButton();
}

window.addEventListener("scroll", updateHeaderScrollState, { passive: true });
updateHeaderScrollState();

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getScrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}

function getStickyOffset() {
  const headerHeight = document.querySelector(".site-header")?.offsetHeight || 0;
  const helper = document.querySelector(".sticky-helper-bar");
  const helperHeight = helper && getComputedStyle(helper).position === "sticky" ? helper.offsetHeight : 0;
  const searchHeight = getComputedStyle(searchForm).position === "sticky" ? searchForm.offsetHeight : 0;

  return headerHeight + helperHeight + searchHeight + 12;
}

function showResults({ keepTyping = false } = {}) {
  window.clearTimeout(searchTimer);
  window.clearTimeout(resultsJumpTimer);
  render();

  if (!resultsSection || resultsSection.hidden) {
    return;
  }

  setDicePanelOpen(false);
  if (!keepTyping) {
    searchInput.blur();
  }
  pendingResultsJump = catalogState === "loading" ? (keepTyping ? "typing" : "submitted") : false;
  // Let the phone keyboard start closing before measuring the results position.
  resultsJumpTimer = window.setTimeout(() => {
    if (!keepTyping) {
      resultsTitle?.focus({ preventScroll: true });
    }
    scrollElementIntoSafeView(resultsSection, keepTyping ? "auto" : getScrollBehavior());
  }, !keepTyping && window.matchMedia("(max-width: 760px)").matches ? 180 : 0);
}

function scrollElementIntoSafeView(element, behavior = getScrollBehavior()) {
  if (!element) {
    return;
  }

  const top = element.getBoundingClientRect().top + window.scrollY - getStickyOffset();
  window.scrollTo({
    top: Math.max(0, top),
    behavior
  });
}

function getResultBatchSize() {
  if (window.matchMedia("(min-width: 1180px)").matches) {
    return 30;
  }

  if (window.matchMedia("(min-width: 760px)").matches) {
    return 24;
  }

  return maxRenderedRows;
}

function getSongKey(song) {
  return `${normalize(song.title)}\u0000${normalize(song.artist)}\u0000${normalize(song.version)}`;
}

function dedupeSongs(songList) {
  const seen = new Set();

  return songList.filter((song) => {
    const key = getSongKey(song);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getResultSignature(query, hasTextQuery, hasFilters) {
  return JSON.stringify({
    query: hasTextQuery ? normalize(query) : "",
    filters: activeFilters.map((filter) => ({
      field: filter.field,
      value: normalize(filter.value),
      matcher: filter.matcher || ""
    })),
    browseAll: Boolean(isBrowseAllActive && !hasTextQuery && !hasFilters)
  });
}

function setDiscoveryVisibility(isActiveResults) {
  document.body.classList.toggle("has-active-results", isActiveResults);
  document.body.classList.toggle("is-browsing-all", isBrowseAllActive);

  if (popularBand) {
    popularBand.hidden = false;
  }

  if (themeSection) {
    const hasThemeFilter = activeFilters.some((filter) =>
      filter.field === "themeTags" || filter.field === "vibes" || filter.field === "themeLabel"
    );
    themeSection.classList.toggle("is-discovery-muted", isActiveResults && !hasThemeFilter);
  }
}

function setBrowseAllActive(isActive) {
  isBrowseAllActive = isActive;

  if (browseAllButton) {
    browseAllButton.classList.toggle("is-active", isBrowseAllActive);
    browseAllButton.setAttribute("aria-pressed", isBrowseAllActive ? "true" : "false");
    browseAllButton.textContent = isBrowseAllActive ? "Browsing All Songs" : "Browse All Songs";
  }
}

const filterFieldLabels = {
  categories: "Genre",
  categoryDetail: "Sub-genre",
  decade: "Decade",
  originalVocal: "Original vocal",
  socialSinging: "Social singing",
  vibes: "Vibe",
  themeTags: "Theme",
  themeLabel: "Theme label"
};

const initialGenreOrder = [
  "Pop",
  "Country",
  "Rock",
  "Soul",
  "Hip-Hop",
  "Blues",
  "Folk",
  "Jazz",
  "R&B",
  "Latin"
].map(normalize);

let genreOptions = [];
let subgenreOptionsByPrimaryGenre = new Map();

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return normalize(value).split(" ").filter(Boolean);
}

function getThemeTags(value) {
  return String(value || "")
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getTagValues(value) {
  return String(value || "")
    .split(/[|,;]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getVersionValues(value) {
  return String(value || "")
    .split(";")
    .map((version) => version.trim())
    .filter(Boolean);
}

function songHasThemeTag(song, slug) {
  return getTagValues(song.themeTags).some((tag) => tag === slug);
}

function songHasVibeTag(song, vibe) {
  const target = normalize(vibe);

  return getTagValues(song.vibes).some((tag) => normalize(tag) === target);
}

function getActiveThemeSlug() {
  return activeFilters.find((filter) => filter.matcher === "themeTag")?.value || "";
}

function getThemeLabelForSong(song, slug) {
  if (!slug) {
    return "";
  }

  const labels = String(song.themeLabels || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  const exactThemeLabel = labels
    .map((item) => {
      const separatorIndex = item.search(/[:=|]/);

      if (separatorIndex === -1) {
        return null;
      }

      return {
        slug: item.slice(0, separatorIndex).trim(),
        label: item.slice(separatorIndex + 1).trim()
      };
    })
    .find((item) => item && item.slug === slug)
    ?.label || "";

  if (exactThemeLabel) {
    return exactThemeLabel;
  }

  if (songHasThemeTag(song, slug)) {
    return labels.find((item) => item.search(/[:=|]/) === -1) || "";
  }

  return "";
}

function getActiveThemeLabelFilter() {
  return activeFilters.find((filter) => filter.matcher === "themeLabel") || null;
}

function songMatchesThemeLabel(song, label) {
  const activeThemeSlug = getActiveThemeSlug();

  return Boolean(activeThemeSlug)
    && normalize(getThemeLabelForSong(song, activeThemeSlug)) === normalize(label);
}

function getThemeLabelTone(label) {
  const toneCount = 6;
  const text = normalize(label);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash + text.charCodeAt(index) * (index + 1)) % toneCount;
  }

  return String(hash + 1);
}

function getThemeLabelsForSlug(slug) {
  const labels = new Map();

  songs.forEach((song) => {
    if (!songHasThemeTag(song, slug)) {
      return;
    }

    const label = getThemeLabelForSong(song, slug);

    if (!label) {
      return;
    }

    labels.set(label, (labels.get(label) || 0) + 1);
  });

  return Array.from(labels.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function renderThemeLabelButtons() {
  if (!themeLabelPanel || !themeLabelButtons) {
    return;
  }

  const activeThemeSlug = getActiveThemeSlug();
  document.body.classList.toggle("theme-active--fourth-of-july", activeThemeSlug === "4th-of-july");

  if (themeSection) {
    themeSection.classList.toggle("theme-band--fourth-of-july", activeThemeSlug === "4th-of-july");
  }

  if (!activeThemeSlug) {
    themeLabelPanel.hidden = true;
    themeLabelButtons.innerHTML = "";
    return;
  }

  const activeLabel = getActiveThemeLabelFilter()?.value || "";
  const labels = getThemeLabelsForSlug(activeThemeSlug);

  themeLabelPanel.hidden = labels.length === 0;
  themeLabelButtons.innerHTML = labels.map(({ label, count }) => {
    const isActive = normalize(label) === normalize(activeLabel);

    return `
      <button
        class="song-theme-label theme-filter-chip song-theme-label-${getThemeLabelTone(label)}${isActive ? " is-active" : ""}"
        type="button"
        data-theme-label="${escapeHtml(label)}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        ${escapeHtml(label)}
        <span class="theme-chip-count">${count.toLocaleString()}</span>
      </button>
    `;
  }).join("");
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve);
  });
}

function getCleanAnalyticsSearchTerm(searchTerm) {
  return String(searchTerm || "").trim().slice(0, 100);
}

function trackKaraokeSearch(searchTerm, resultCount) {
  const cleanSearchTerm = getCleanAnalyticsSearchTerm(searchTerm);
  if (cleanSearchTerm.length < minimumSearchLength) return;

  const normalizedResultCount = Number(resultCount) || 0;
  const hasResults = normalizedResultCount > 0;

  sendAnalyticsEvent("karaoke_search", {
    search_term: cleanSearchTerm,
    result_count: normalizedResultCount,
    has_results: hasResults,
    page_location: window.location.href,
    page_title: document.title || "Karaoke Song Search",
    content_group: "karaoke"
  });

  if (!hasResults) {
    sendAnalyticsEvent("karaoke_no_results", {
      search_term: cleanSearchTerm,
      result_count: 0,
      page_location: window.location.href,
      page_title: document.title || "Karaoke Song Search",
      content_group: "karaoke"
    });
  }
}

function sendAnalyticsEvent(eventName, params) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
    return;
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(["event", eventName, params]);
}

function scheduleKaraokeSearchTracking(searchTerm, resultCount) {
  const cleanSearchTerm = getCleanAnalyticsSearchTerm(searchTerm);

  if (cleanSearchTerm.length < minimumSearchLength) {
    window.clearTimeout(analyticsSearchTimer);
    return;
  }

  const normalizedResultCount = Number(resultCount) || 0;
  const nextSearch = {
    searchTerm: cleanSearchTerm,
    resultCount: normalizedResultCount
  };

  if (
    lastTrackedSearch
    && lastTrackedSearch.searchTerm === nextSearch.searchTerm
    && lastTrackedSearch.resultCount === nextSearch.resultCount
  ) {
    return;
  }

  window.clearTimeout(analyticsSearchTimer);
  analyticsSearchTimer = window.setTimeout(() => {
    trackKaraokeSearch(nextSearch.searchTerm, nextSearch.resultCount);
    lastTrackedSearch = nextSearch;
  }, 1000);
}

function trackAnalyticsElement(trackedElement) {
  if (!trackedElement) return;

  const eventName = trackedElement.dataset.analyticsEvent || "";
  if (!eventName) return;

  if (eventName === "karaoke_result_click") {
    sendAnalyticsEvent(eventName, {
      song_title: trackedElement.dataset.songTitle || "",
      artist_name: trackedElement.dataset.artistName || "",
      search_term: getCleanAnalyticsSearchTerm(currentSearchQuery),
      page_location: window.location.href,
      content_group: "karaoke"
    });
    return;
  }

  sendAnalyticsEvent(eventName, {
    event_category: trackedElement.dataset.analyticsCategory || "engagement",
    event_label: trackedElement.dataset.analyticsLabel || trackedElement.textContent.trim(),
    link_url: trackedElement.href || "",
    page_location: window.location.href,
    page_title: document.title || "Karaoke Song Search",
    content_group: "karaoke"
  });
}

function getDecadeAliases(value) {
  const decade = normalize(value);
  const aliases = new Set();
  const fourDigitMatch = decade.match(/^(\d{2})(\d{2})s$/);
  const twoDigitMatch = decade.match(/^(\d{2})s$/);

  if (decade) {
    aliases.add(decade);
  }

  if (fourDigitMatch) {
    aliases.add(`${fourDigitMatch[2]}s`);
  }

  if (twoDigitMatch) {
    const year = Number(twoDigitMatch[1]);
    aliases.add(`${year <= 30 ? "20" : "19"}${twoDigitMatch[1]}s`);
  }

  return Array.from(aliases);
}

function deriveDecadeFromYear(value) {
  const yearMatch = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);

  if (!yearMatch) {
    return "";
  }

  const year = Number(yearMatch[1]);
  const decadeStart = Math.floor(year / 10) * 10;

  return decadeStart >= 2000 ? `${decadeStart}s` : `${String(decadeStart).slice(2)}s`;
}

function getArtistAliases(artist) {
  const normalizedArtist = normalize(artist);
  const aliases = new Set();

  if (normalizedArtist.includes("p nk")) {
    aliases.add("Pink");
    aliases.add(String(artist || "").replace(/P!nk/gi, "Pink"));
  }

  if (normalizedArtist.includes("too hort")) {
    aliases.add("Too Short");
    aliases.add(String(artist || "").replace(/Too \$hort/gi, "Too Short"));
  }

  if (normalizedArtist.includes("ty dolla ign")) {
    aliases.add("Ty Dolla Sign");
    aliases.add(String(artist || "").replace(/Ty Dolla \$ign/gi, "Ty Dolla Sign"));
  }

  if (normalizedArtist.includes("the chicks")) {
    aliases.add("Dixie Chicks");
  }

  if (normalizedArtist.includes("dixie chicks")) {
    aliases.add("The Chicks");
  }

  if (normalizedArtist === "lady a" || normalizedArtist.startsWith("lady a ") || normalizedArtist.includes(" lady a ")) {
    aliases.add("Lady Antebellum");
  }

  if (normalizedArtist.includes("lady antebellum") || normalizedArtist.includes("lady antebullum")) {
    aliases.add("Lady A");
  }

  return Array.from(aliases);
}

function getSearchPieces(song) {
  const decadeAliases = getDecadeAliases(song.decade);
  const artistAliases = getArtistAliases(song.artist);
  return [
    song.title,
    song.artist,
    ...artistAliases,
    song.categories,
    song.vibes,
    song.socialSinging,
    song.decade,
    ...decadeAliases,
    song.year,
    song.originalVocal,
    song.version
  ].filter(Boolean);
}

function fieldMatchesQuery(song, fieldName, queryTerms) {
  if (!fieldName) {
    return false;
  }

  const fieldText = normalize(song[fieldName]);
  const fieldTerms = tokenize(fieldText);
  const queryPhrase = queryTerms.join(" ");
  const singularFieldTerms = fieldTerms.map((term) => term.endsWith("s") ? term.slice(0, -1) : term);
  const singularQueryTerms = queryTerms.map((term) => term.endsWith("s") ? term.slice(0, -1) : term);

  return queryTerms.length > 0 && (
    fieldText === queryPhrase
    || (queryTerms.length > 1 && fieldText.includes(queryPhrase))
    || queryTerms.every((term) => fieldTerms.includes(term))
    || singularQueryTerms.every((term) => singularFieldTerms.includes(term))
  );
}

function getCategoryValues(value) {
  return String(value || "")
    .split(/[|,]/)
    .map((category) => category.trim())
    .filter(Boolean);
}

function getPrimaryGenre(song) {
  return getCategoryValues(song.categories)[0] || "";
}

function getSubgenreValues(song) {
  return getCategoryValues(song.categories).slice(1);
}

function primaryGenreMatches(song, value) {
  return normalize(getPrimaryGenre(song)) === normalize(value);
}

function subgenreMatches(song, value) {
  const target = normalize(value);

  return getSubgenreValues(song).some((category) => normalize(category) === target);
}

function sortByCountThenLabel(entries) {
  return entries.sort((a, b) => {
    const countDifference = b.count - a.count;

    if (countDifference !== 0) {
      return countDifference;
    }

    return a.label.localeCompare(b.label);
  });
}

function sortPrimaryGenreOptions(entries) {
  const preferredGenres = [];
  const remainingGenres = [];

  entries.forEach((entry) => {
    const preferredIndex = initialGenreOrder.indexOf(normalize(entry.label));

    if (preferredIndex === -1) {
      remainingGenres.push(entry);
    } else {
      preferredGenres.push({ ...entry, preferredIndex });
    }
  });

  preferredGenres.sort((a, b) => a.preferredIndex - b.preferredIndex);
  sortByCountThenLabel(remainingGenres);

  return [
    ...preferredGenres.map(({ preferredIndex, ...entry }) => entry),
    ...remainingGenres
  ];
}

function buildGenreOptions(songList) {
  const primaryCounts = new Map();
  const subgenreCountsByGenre = new Map();

  songList.forEach((song) => {
    const categoryValues = getCategoryValues(song.categories);
    const primaryGenre = categoryValues[0] || "";

    if (!primaryGenre) {
      return;
    }

    const primaryKey = normalize(primaryGenre);
    const primaryEntry = primaryCounts.get(primaryKey) || {
      value: primaryGenre,
      label: primaryGenre,
      count: 0
    };
    primaryEntry.count += 1;
    primaryCounts.set(primaryKey, primaryEntry);

    if (!subgenreCountsByGenre.has(primaryKey)) {
      subgenreCountsByGenre.set(primaryKey, new Map());
    }

    const subgenreCounts = subgenreCountsByGenre.get(primaryKey);
    categoryValues.slice(1).forEach((subgenre) => {
      const subgenreKey = normalize(subgenre);

      if (!subgenreKey || subgenreKey === primaryKey) {
        return;
      }

      const subgenreEntry = subgenreCounts.get(subgenreKey) || {
        value: subgenre,
        label: subgenre,
        count: 0
      };
      subgenreEntry.count += 1;
      subgenreCounts.set(subgenreKey, subgenreEntry);
    });
  });

  genreOptions = sortPrimaryGenreOptions(Array.from(primaryCounts.values()));
  subgenreOptionsByPrimaryGenre = new Map(
    Array.from(subgenreCountsByGenre.entries()).map(([genreKey, subgenreCounts]) => [
      genreKey,
      sortByCountThenLabel(Array.from(subgenreCounts.values())).slice(0, 40)
    ])
  );
}

function getActiveGenreFilter() {
  return activeFilters.find((filter) => filter.field === "categories") || null;
}

function clearGenreFilters() {
  activeFilters = activeFilters.filter((filter) =>
    filter.field !== "categories" && filter.field !== "categoryDetail"
  );
  visibleSubgenreCount = 10;
}

function getFilterLabel(fieldName) {
  return filterFieldLabels[fieldName] || fieldName;
}

function songMatchesFilter(song, filter) {
  if (filter.matcher === "themeTag") {
    return songHasThemeTag(song, filter.value);
  }

  if (filter.matcher === "vibeTag") {
    return songHasVibeTag(song, filter.value);
  }

  if (filter.matcher === "themeLabel") {
    return songMatchesThemeLabel(song, filter.value);
  }

  if (filter.matcher === "primaryGenre") {
    return primaryGenreMatches(song, filter.value);
  }

  if (filter.matcher === "subgenre") {
    return subgenreMatches(song, filter.value);
  }

  return fieldMatchesQuery(song, filter.field, tokenize(filter.value));
}

function songMatchesActiveFilters(song) {
  return activeFilters.every((filter) => songMatchesFilter(song, filter));
}

function updateFilterSummary() {
  if (filterTotal) {
    filterTotal.textContent = activeFilters.length ? `(${activeFilters.length})` : "";
  }
  if (!filterSummary) {
    return;
  }

  if (activeFilters.length === 0) {
    filterSummary.hidden = true;
    filterSummary.innerHTML = "";
    if (clearFiltersButton) {
      clearFiltersButton.hidden = true;
    }
    return;
  }

  filterSummary.innerHTML = activeFilters
    .map((filter) => `
      <button
        class="active-filter-chip"
        type="button"
        data-remove-field="${escapeHtml(filter.field)}"
        data-remove-value="${escapeHtml(filter.value)}"
        aria-label="Remove ${escapeHtml(filter.label)} filter"
      >
        <span>${escapeHtml(filter.label)}</span>
        <span aria-hidden="true">&times;</span>
      </button>
    `).join("");
  filterSummary.hidden = false;

  if (clearFiltersButton) {
    clearFiltersButton.hidden = false;
  }
}

function updateFilterSectionVisibility() {
  filterCategoryButtons.forEach((button) => {
    const isOpen = button.dataset.filterSection === activeFilterSection;
    button.classList.toggle("is-active", isOpen);
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  filterGroups.forEach((group) => {
    group.hidden = group.dataset.filterGroup !== activeFilterSection;
  });
}

function updateJumpResultsButton(count = 0) {
  if (!jumpResultsButton) {
    return;
  }

  const hasResults = resultsSection && !resultsSection.hidden;
  jumpResultsButton.hidden = !hasResults;

  if (hasResults) {
    jumpResultsButton.textContent = count > 0 ? `View ${count.toLocaleString()} songs` : "View Results";
  }
}

function updateReturnSearchButton() {
  if (!returnSearchButton || !resultsSection || resultsSection.hidden) {
    if (returnSearchButton) {
      returnSearchButton.hidden = true;
    }
    return;
  }

  const controlsBottom = searchControls?.getBoundingClientRect().bottom || 0;
  returnSearchButton.hidden = controlsBottom > getStickyOffset() + 20;
}

function updateBrowseButtonStates() {
  const activeGenre = getActiveGenreFilter();

  renderGenreButtons();

  if (subgenrePanel && subgenreButtons) {
    renderSubgenreButtons(activeGenre);
  }

  browseButtons = document.querySelectorAll(".browse-button");
  browseButtons.forEach((button) => {
    let isActive = false;

    if (button.dataset.clearField) {
      if (button.dataset.clearField === "genre") {
        isActive = !activeFilters.some((filter) =>
          filter.field === "categories" || filter.field === "categoryDetail"
        );
      } else {
        isActive = !activeFilters.some((filter) => filter.field === button.dataset.clearField);
      }
    } else {
      isActive = activeFilters.some((filter) =>
        filter.field === button.dataset.field && filter.value === button.dataset.search
      );
    }

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  filterCategoryButtons.forEach((button) => {
    const section = button.dataset.filterSection;
    const hasActiveFilter = activeFilters.some((filter) => {
      if (section === "genre") {
        return filter.field === "categories" || filter.field === "categoryDetail";
      }

      if (section === "vocal") {
        return filter.field === "originalVocal";
      }

      if (section === "social") {
        return filter.field === "socialSinging";
      }

      return filter.field === section;
    });

    button.classList.toggle("has-active-filter", hasActiveFilter);
  });

  updateFilterSectionVisibility();
}

function renderGenreButtons() {
  if (!genreButtons) {
    return;
  }

  const visibleGenres = genreOptions.slice(0, visibleGenreCount);
  const remainingGenreCount = Math.max(0, genreOptions.length - visibleGenres.length);
  const moreButton = remainingGenreCount > 0
    ? `
      <button class="browse-button genre-more-button" type="button">
        Show More Genres
      </button>
    `
    : "";

  genreButtons.innerHTML = [
    `<button class="browse-button" type="button" data-clear-field="genre" aria-pressed="false">All</button>`,
    ...visibleGenres.map((genre) => `
      <button
        class="browse-button"
        type="button"
        data-search="${escapeHtml(genre.value)}"
        data-field="categories"
        data-matcher="primaryGenre"
      >${escapeHtml(genre.label)}</button>
    `),
    moreButton
  ].join("");
}

function renderSubgenreButtons(activeGenre) {
  if (!subgenreButtons) {
    return;
  }

  const subgenres = subgenreOptionsByPrimaryGenre.get(normalize(activeGenre?.value)) || [];

  if (!activeGenre || activeFilterSection !== "genre" || subgenres.length === 0) {
    if (subgenrePanel) {
      subgenrePanel.hidden = true;
    }
    subgenreButtons.innerHTML = "";
    return;
  }

  if (subgenrePanel) {
    subgenrePanel.hidden = false;
  }

  const visibleSubgenres = subgenres.slice(0, visibleSubgenreCount);
  const showMoreButton = visibleSubgenres.length < subgenres.length
    ? `
      <button class="browse-button subgenre-more-button" type="button">
        Show More
      </button>
    `
    : "";

  subgenreButtons.innerHTML = visibleSubgenres.map((category) => `
    <button
      class="browse-button subgenre-button"
      type="button"
      data-search="${escapeHtml(category.value)}"
      data-field="categoryDetail"
      data-matcher="subgenre"
    >${escapeHtml(category.label)}</button>
  `).join("") + showMoreButton;
}

function setFilterFromButton(button) {
  setBrowseAllActive(false);
  const clearField = button.dataset.clearField || "";
  const field = button.dataset.field || "";
  const value = button.dataset.search || "";

  if (clearField) {
    if (clearField === "genre") {
      clearGenreFilters();
    } else {
      activeFilters = activeFilters.filter((filter) => filter.field !== clearField);
    }
    updateFilterSummary();
    updateBrowseButtonStates();
    updateThemeClearButton();
    return;
  }

  if (!field || !value) {
    return;
  }

  if (field === "categories") {
    activeFilters = activeFilters.filter((filter) => filter.field !== "categoryDetail");
    visibleSubgenreCount = 10;
  }

  const existingIndex = activeFilters.findIndex((filter) => filter.field === field);
  const existing = existingIndex === -1 ? null : activeFilters[existingIndex];

  if (existing && existing.value === value) {
    activeFilters.splice(existingIndex, 1);
  } else if (existingIndex === -1) {
    activeFilters.push({
      field,
      value,
      label: button.textContent.trim(),
      matcher: button.dataset.matcher || ""
    });
  } else {
    activeFilters[existingIndex] = {
      field,
      value,
      label: button.textContent.trim(),
      matcher: button.dataset.matcher || ""
    };
  }

  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
}

function removeFilter(field, value) {
  if (!field) {
    return;
  }

  activeFilters = activeFilters.filter((filter) =>
    !(filter.field === field && (!value || filter.value === value))
  );

  if (field === "categories") {
    activeFilters = activeFilters.filter((filter) => filter.field !== "categoryDetail");
    visibleSubgenreCount = 10;
  }

  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  renderThemeLabelButtons();
}

function clearFilters() {
  activeFilters = [];
  activeFilterSection = "vocal";
  visibleGenreCount = 10;
  visibleSubgenreCount = 10;
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  renderThemeLabelButtons();
}

function termMatchesText(term, text, tokens) {
  if (!term) {
    return false;
  }

  if (tokens.includes(term)) {
    return true;
  }

  if (term.length < 3) {
    return false;
  }

  return tokens.some((token) => token.startsWith(term));
}

function allTermsMatchText(queryTerms, text) {
  const tokens = tokenize(text);
  return queryTerms.length > 0 && queryTerms.every((term) => termMatchesText(term, text, tokens));
}

function parseRankingScore(value) {
  const score = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(score) ? score : 0;
}

function getRankingScore(song) {
  return typeof song.rankingScore === "number" ? song.rankingScore : 0;
}

function getSearchScore(song, normalizedQuery, queryTerms, preferredField = "") {
  const titleText = normalize(song.title);
  const artistText = normalize(song.artist);
  const artistAliasTexts = getArtistAliases(song.artist).map(normalize);
  const artistSearchText = normalize([song.artist, ...getArtistAliases(song.artist)].join(" "));
  const titleArtistText = normalize(`${song.title} ${song.artist} ${getArtistAliases(song.artist).join(" ")}`);
  const searchableText = song.searchText || normalize(getSearchPieces(song).join(" "));
  const yearText = normalize(song.year);

  if (fieldMatchesQuery(song, preferredField, queryTerms)) {
    return 0;
  }

  if (normalizedQuery && titleText === normalizedQuery) {
    return 1;
  }

  if (normalizedQuery && artistText === normalizedQuery) {
    return 2;
  }

  if (normalizedQuery && artistAliasTexts.includes(normalizedQuery)) {
    return 2;
  }

  if (normalizedQuery && titleText.includes(normalizedQuery)) {
    return 3;
  }

  if (normalizedQuery && artistText.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedQuery && artistSearchText.includes(normalizedQuery)) {
    return 4;
  }

  if (allTermsMatchText(queryTerms, titleArtistText)) {
    return 5;
  }

  if (yearText && queryTerms.includes(yearText)) {
    return 6;
  }

  if (normalizedQuery && searchableText.includes(normalizedQuery)) {
    return 7;
  }

  if (allTermsMatchText(queryTerms, searchableText)) {
    return 8;
  }

  return null;
}

function indexSongs(nextSongs) {
  return nextSongs
    .filter((song) => song.title || song.artist)
    .map((song) => {
      const title = String(song.title || "").trim();
      const artist = String(song.artist || "").trim();
      const categories = String(song.categories || "").trim();
      const vibes = String(song.vibes || "").trim();
      const socialSinging = String(song.socialSinging || "").trim();
      const version = String(song.version || "").trim();
      const originalVocal = String(song.originalVocal || "").trim();
      const year = String(song.year || "").trim();
      const decade = String(song.decade || "").trim() || deriveDecadeFromYear(year);
      const themeTags = String(song.themeTags || "").trim();
      const themeLabels = String(song.themeLabels || "").trim();
      const rankingScore = parseRankingScore(song.rankingScore);
      const searchPieces = getSearchPieces({ title, artist, categories, vibes, socialSinging, decade, year, originalVocal, version });
      const searchText = normalize(searchPieces.join(" "));
      const compactFields = [
        normalize(title).replace(/\s/g, ""),
        normalize(artist).replace(/\s/g, ""),
        ...getArtistAliases(artist).map((alias) => normalize(alias).replace(/\s/g, "")),
        normalize(categories).replace(/\s/g, ""),
        normalize(vibes).replace(/\s/g, ""),
        normalize(socialSinging).replace(/\s/g, ""),
        normalize(decade).replace(/\s/g, ""),
        normalize(year).replace(/\s/g, ""),
        normalize(originalVocal).replace(/\s/g, ""),
        normalize(version).replace(/\s/g, "")
      ].filter(Boolean);

      return {
        title,
        artist,
        categories,
        vibes,
        socialSinging,
        version,
        decade,
        year,
        originalVocal,
        themeTags,
        themeLabels,
        rankingScore,
        searchText,
        compactFields,
        titleStarts: normalize(title),
        artistStarts: normalize(artist),
        fuzzyTerms: Array.from(new Set(tokenize(searchPieces.join(" "))))
      };
    })
    ;
}

function hydrateIndexedSongs(indexPayload) {
  const rows = Array.isArray(indexPayload) ? indexPayload : indexPayload.songs;

  if (!Array.isArray(rows)) {
    throw new Error("Search index is not in the expected format.");
  }

  return rows
    .map((row) => {
      const compactFieldSource = Array.isArray(row[4])
        ? row[4]
        : row[4] && Array.isArray(row[4].value)
          ? row[4].value
          : null;
      const fuzzyTermSource = Array.isArray(row[5])
        ? row[5]
        : row[5] && Array.isArray(row[5].value)
          ? row[5].value
          : null;
      const title = String(row[0] || "").trim();
      const artist = String(row[1] || "").trim();
      const categories = String(row[2] || "").trim();
      const originalVocal = String(row[9] || "").trim();
      const year = String(row[10] || "").trim();
      const decade = String(row[8] || "").trim() || deriveDecadeFromYear(year);
      const socialSinging = String(row[11] || "").trim();
      const rankingScore = parseRankingScore(row[12]);
      const themeTags = String(row[13] || "").trim();
      const themeLabels = String(row[14] || "").trim();
      const version = String(row[15] || "").trim();
      const vibes = String(row[16] || "").trim();
      const searchPieces = getSearchPieces({ title, artist, categories, vibes, socialSinging, decade, year, originalVocal, version });
      const searchText = String(row[3] || normalize(searchPieces.join(" ")));
      const compactFields = compactFieldSource
        ? compactFieldSource
        : [normalize(title).replace(/\s/g, ""), normalize(artist).replace(/\s/g, ""), normalize(categories).replace(/\s/g, ""), normalize(vibes).replace(/\s/g, ""), normalize(socialSinging).replace(/\s/g, ""), normalize(decade).replace(/\s/g, ""), normalize(year).replace(/\s/g, ""), normalize(originalVocal).replace(/\s/g, ""), normalize(version).replace(/\s/g, "")].filter(Boolean);
      const fuzzyTerms = fuzzyTermSource
        ? fuzzyTermSource
        : Array.from(new Set(tokenize(searchPieces.join(" "))));

      return {
        title,
        artist,
        categories,
        vibes,
        socialSinging,
        version,
        decade,
        year,
        originalVocal,
        themeTags,
        themeLabels,
        rankingScore,
        searchText,
        compactFields,
        fuzzyTerms,
        titleStarts: String(row[6] || normalize(title)),
        artistStarts: String(row[7] || normalize(artist))
      };
    })
    .filter((song) => song.title || song.artist)
    ;
}

function editDistanceWithin(a, b, maxDistance) {
  if (Math.abs(a.length - b.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    let rowMinimum = current[0];

    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost
      );

      current[column] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) {
      return maxDistance + 1;
    }

    previous = current;
  }

  return previous[b.length];
}

function allowedTypoDistance(term) {
  if (term.length < 4) {
    return 0;
  }

  if (term.length < 8) {
    return 1;
  }

  return 2;
}

function fuzzyRank(song, queryTerms) {
  let totalDistance = 0;
  const meaningfulTerms = queryTerms.filter((term) => term.length >= 3);

  if (meaningfulTerms.length >= 2) {
    const compactQuery = meaningfulTerms.join("");
    const phraseDistance = allowedTypoDistance(compactQuery);

    if (song.compactFields.some((field) => field.includes(compactQuery))) {
      return 0;
    }

    if (!song.fuzzyTerms.some((term) => meaningfulTerms.includes(term))) {
      return null;
    }

    if (compactQuery.length >= 7 && song.compactFields.some((field) => editDistanceWithin(compactQuery, field, phraseDistance) <= phraseDistance)) {
      return phraseDistance;
    }
  }

  for (const queryTerm of queryTerms) {
    const maxDistance = allowedTypoDistance(queryTerm);
    let bestDistance = maxDistance + 1;

    for (const songTerm of song.fuzzyTerms) {
      if (songTerm.includes(queryTerm) || queryTerm.includes(songTerm)) {
        bestDistance = 0;
        break;
      }

      if (maxDistance > 0) {
        bestDistance = Math.min(bestDistance, editDistanceWithin(queryTerm, songTerm, maxDistance));
      }

      if (bestDistance === 0) {
        break;
      }
    }

    if (bestDistance > maxDistance) {
      return null;
    }

    totalDistance += bestDistance;
  }

  return totalDistance;
}

function renderRequestSong(query) {
  if (resultsSection) {
    resultsSection.hidden = false;
  }
  setDiscoveryVisibility(true);
  resultsBody.innerHTML = "";
  resultsBody.closest("table").hidden = true;
  resultsTitle.textContent = "Search results";
  currentSearchMatches = [];
  currentSearchQuery = "";
  visibleResultCount = maxRenderedRows;
  lastResultSignature = "";
  if (loadMoreButton) {
    loadMoreButton.hidden = true;
  }
  if (similarPanel) {
    similarPanel.hidden = true;
  }
  emptyState.innerHTML = `
    <span>No match here, but ask the KJ. We may have it in the full catalog.</span>
  `;
  emptyState.hidden = false;
  resultCount.textContent = "0 songs";
  updateJumpResultsButton(0);
  updateReturnSearchButton();
  scheduleKaraokeSearchTracking(query, 0);
}

function openRequestSong(url) {
  try {
    window.top.location.assign(url);
  } catch {
    window.location.assign(url);
  }
}

function handleRequestSongActivation(event) {
  const requestLink = event.target.closest(".request-song-button");

  if (!requestLink || requestNavigationStarted) {
    return;
  }

  requestNavigationStarted = true;
  event.preventDefault();
  openRequestSong(requestLink.href);

  window.setTimeout(() => {
    requestNavigationStarted = false;
  }, 2000);
}

function hideSearchResults() {
  if (resultsSection) {
    resultsSection.hidden = true;
  }

  setDiscoveryVisibility(false);
  resultsBody.innerHTML = "";
  emptyState.hidden = true;
  currentSearchMatches = [];
  currentSearchQuery = "";
  visibleResultCount = maxRenderedRows;
  lastResultSignature = "";
  if (loadMoreButton) {
    loadMoreButton.hidden = true;
  }
  resultCount.textContent = songs.length ? `${songs.length.toLocaleString()} songs loaded` : "Loading songs...";
  updateJumpResultsButton(0);

  if (similarPanel) {
    similarPanel.hidden = true;
  }
  updateReturnSearchButton();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function highlight(value, query) {
  const safeValue = escapeHtml(value);
  const term = query.trim();

  if (!term) {
    return safeValue;
  }

  const index = normalize(value).indexOf(normalize(term));

  if (index === -1) {
    return safeValue;
  }

  const raw = String(value);
  const before = escapeHtml(raw.slice(0, index));
  const match = escapeHtml(raw.slice(index, index + term.length));
  const after = escapeHtml(raw.slice(index + term.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function getRandomSongsByVocal(vocal, limit) {
  const vocalKey = normalize(vocal);
  return getRandomSongsWhere((song) => normalize(song.originalVocal) === vocalKey, limit);
}

function getRandomSongsWhere(predicate, limit) {
  const candidates = songs.filter(predicate);

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = candidates[index];
    candidates[index] = candidates[swapIndex];
    candidates[swapIndex] = current;
  }

  return candidates.slice(0, limit);
}

function getRandomSongsBySocial(term, limit) {
  const target = normalize(term);
  return getRandomSongsWhere((song) => normalize(song.socialSinging).includes(target), limit);
}

function renderDiceList(target, songList) {
  if (!target) {
    return;
  }

  target.innerHTML = songList.map((song) => `
    <li class="song-row dice-song-row"
      data-song-title="${escapeHtml(song.title)}"
      data-song-artist="${escapeHtml(song.artist)}"
      data-song-meta="${escapeHtml([song.originalVocal ? `Original vocal: ${song.originalVocal}` : "", song.socialSinging || "", song.version || ""].filter(Boolean).join(" | "))}"
    >
      <button class="song-select-button" type="button" aria-label="Select ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}">
      <span class="dice-song-title">${escapeHtml(song.title)}</span>
      <span class="dice-song-artist">${escapeHtml(song.artist)}</span>
      </button>
    </li>
  `).join("");
}

function setDicePanelOpen(isOpen, options = {}) {
  if (!dicePanel) {
    return;
  }

  dicePanel.hidden = !isOpen;
  topDiceButton?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  const topDiceLabel = topDiceButton?.querySelector("span");

  if (topDiceLabel) {
    topDiceLabel.textContent = isOpen ? "Close Random Picks" : "Let Chance Decide";
  }

  if (!isOpen) {
    if (options.restoreFocus) {
      topDiceButton?.focus({ preventScroll: true });
    }
    return;
  }

  if (options.focusPanel) {
    dicePanel.focus({ preventScroll: true });
  }

  window.requestAnimationFrame(() => {
    if (dicePanel.hidden) {
      return;
    }
    const rect = dicePanel.getBoundingClientRect();

    if (rect.top < getStickyOffset() || rect.top > window.innerHeight - 120) {
      scrollElementIntoSafeView(dicePanel);
    }
  });
}

function rollDiceSuggestions() {
  renderDiceList(diceFemaleResults, getRandomSongsByVocal("female", 4));
  renderDiceList(diceMaleResults, getRandomSongsByVocal("male", 4));
  renderDiceList(diceDuetResults, getRandomSongsBySocial("duet", 4));
  renderDiceList(diceGroupResults, getRandomSongsBySocial("group", 4));
  hasRolledDice = true;

  if (diceResults) {
    diceResults.hidden = false;
  }
}

function getCategoryTerms(song) {
  return tokenize(song.categories).filter((term) => term.length >= 3);
}

function getSongYear(song) {
  const year = Number(String(song.year || "").replace(/[^0-9]/g, ""));
  return Number.isInteger(year) && year >= 1900 && year <= 2099 ? year : null;
}

function getClosestYearDistance(song, referenceYears) {
  const songYear = getSongYear(song);

  if (songYear === null || referenceYears.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...referenceYears.map((year) => Math.abs(songYear - year)));
}

function renderSongRows(songList, query = "") {
  const activeThemeSlug = getActiveThemeSlug();

  return songList.map((song) => {
    const themeLabel = getThemeLabelForSong(song, activeThemeSlug);
    const themeLabelMarkup = themeLabel
      ? `<button class="song-theme-label song-theme-label-${getThemeLabelTone(themeLabel)}" type="button" data-theme-label="${escapeHtml(themeLabel)}" data-analytics-event="karaoke_result_click" data-song-title="${escapeHtml(song.title)}" data-artist-name="${escapeHtml(song.artist)}">${escapeHtml(themeLabel)}</button>`
      : "";
    const versionMarkup = getVersionValues(song.version)
      .map((version) => `<span class="song-version-tile">${escapeHtml(version)}</span>`)
      .join("");
    const meta = [
      song.originalVocal ? `Original vocal: ${song.originalVocal}` : "",
      song.socialSinging || "",
      song.version || ""
    ].filter(Boolean).join(" | ");

    return `
    <tr
      class="song-row"
      data-song-title="${escapeHtml(song.title)}"
      data-song-artist="${escapeHtml(song.artist)}"
      data-song-meta="${escapeHtml(meta)}"
    >
      <td data-label="Title">
        <span class="song-cell-content">
          <button class="song-select-button" type="button" aria-label="Select ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}">${query ? highlight(song.title, query) : escapeHtml(song.title)}</button>
          ${versionMarkup}
          ${themeLabelMarkup}
        </span>
      </td>
      <td data-label="Artist">
        <span class="song-cell-content">
          <span>${query ? highlight(song.artist, query) : escapeHtml(song.artist)}</span>
        </span>
      </td>
    </tr>
  `;
  }).join("");
}

function openSongDialog(row) {
  if (!songDialog || !songDialogTitle || !songDialogArtist || !songDialogMeta || !row) {
    return;
  }

  lastDialogTrigger = row.classList.contains("dice-song-row") ? topDiceButton : row.querySelector(".song-select-button");
  songDialogTitle.textContent = row.dataset.songTitle || "Selected song";
  songDialogArtist.textContent = row.dataset.songArtist || "";
  songDialogMeta.textContent = row.dataset.songMeta || "";
  songDialogMeta.hidden = !songDialogMeta.textContent;

  if (typeof songDialog.showModal === "function") {
    songDialog.showModal();
    return;
  }

  songDialog.setAttribute("open", "");
}

function restoreDialogFocus() {
  if (lastDialogTrigger && typeof lastDialogTrigger.focus === "function") {
    lastDialogTrigger.focus({ preventScroll: true });
  }
  lastDialogTrigger = null;
}

function mixThemeLabelGroups(sortedSongs) {
  const activeThemeSlug = getActiveThemeSlug();

  if (!activeThemeSlug || getActiveThemeLabelFilter()) {
    return sortedSongs;
  }

  const groups = new Map();

  sortedSongs.forEach((song) => {
    const label = getThemeLabelForSong(song, activeThemeSlug) || "Other picks";

    if (!groups.has(label)) {
      groups.set(label, []);
    }

    groups.get(label).push(song);
  });

  if (groups.size <= 1) {
    return sortedSongs;
  }

  const shuffledGroups = Array.from(groups.values())
    .map((group) => ({ group, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.group);
  const mixedSongs = [];
  let cursor = 0;

  while (mixedSongs.length < sortedSongs.length) {
    const group = shuffledGroups[cursor % shuffledGroups.length];
    const song = group.shift();

    if (song) {
      mixedSongs.push(song);
    }

    cursor += 1;

    if (shuffledGroups.every((item) => item.length === 0)) {
      break;
    }
  }

  return mixedSongs;
}

function getTopSongs(limit = 10) {
  const tieBreakers = new Map();

  return songs
    .filter((song) => getRankingScore(song) > 0)
    .map((song) => {
      const key = `${song.title}\u0000${song.artist}`;

      if (!tieBreakers.has(key)) {
        tieBreakers.set(key, Math.random());
      }

      return {
        song,
        tieBreaker: tieBreakers.get(key)
      };
    })
    .sort((a, b) =>
      getRankingScore(b.song) - getRankingScore(a.song)
      || a.tieBreaker - b.tieBreaker
      || a.song.title.localeCompare(b.song.title)
      || a.song.artist.localeCompare(b.song.artist)
    )
    .slice(0, limit)
    .map((item) => item.song);
}

function renderTopSongs() {
  if (!topSongsPanel || !topSongsBody) {
    return;
  }

  const topSongs = getTopSongs(10);
  topSongsPanel.hidden = topSongs.length === 0;
  topSongsBody.innerHTML = renderSongRows(topSongs);
}

function renderVisibleSearchResults(matchCount, usedTypoMatching, append = false) {
  currentUsedTypoMatching = usedTypoMatching;
  const visibleMatches = currentSearchMatches.slice(0, visibleResultCount);
  const visibleCount = visibleMatches.length;
  const batchSize = getResultBatchSize();
  if (append) {
    const renderedCount = resultsBody.children.length;
    resultsBody.insertAdjacentHTML("beforeend", renderSongRows(visibleMatches.slice(renderedCount), currentSearchQuery));
  } else {
    resultsBody.innerHTML = renderSongRows(visibleMatches, currentSearchQuery);
  }
  resultsBody.closest("table").hidden = false;

  if (loadMoreButton) {
    loadMoreButton.hidden = visibleResultCount >= currentSearchMatches.length;
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = `Show ${Math.min(batchSize, Math.max(0, currentSearchMatches.length - visibleResultCount)).toLocaleString()} more songs`;
  }

  emptyState.hidden = true;
  const total = currentSearchMatches.length;
  const shownText = visibleCount < total ? `Showing ${visibleCount.toLocaleString()} of ${total.toLocaleString()} songs` : `${total.toLocaleString()} song${total === 1 ? "" : "s"}`;
  const typoText = usedTypoMatching ? " including close matches" : "";
  resultCount.textContent = `${shownText}${typoText}`;
  updateJumpResultsButton(total);
  updateReturnSearchButton();
}

function renderSimilarSongs(matches, query, queryTerms) {
  if (!similarPanel || !similarBody || !similarTitle) {
    return;
  }

  similarPanel.hidden = true;
  similarBody.innerHTML = "";

  if (matches.length === 0 || matches.length >= 5) {
    return;
  }

  const matchSet = new Set(matches);
  let similarSongs = [];
  const normalizedQuery = normalize(query);
  const artistIntent = matches.some((song) => song.artistStarts.includes(normalizedQuery));
  const titleIntent = matches.some((song) => song.titleStarts.includes(normalizedQuery));
  const matchingArtists = new Set(matches.map((song) => normalize(song.artist)).filter(Boolean));
  const categoryTerms = new Set(matches.flatMap(getCategoryTerms));
  const referenceYears = matches.map(getSongYear).filter((year) => year !== null);
  const similarLimit = Math.max(0, 5 - matches.length);
  const candidates = [];
  const artistMatches = [];

  for (const song of songs) {
    if (matchSet.has(song)) {
      continue;
    }

    if (titleIntent && !artistIntent && matchingArtists.has(normalize(song.artist))) {
      artistMatches.push(song);
      continue;
    }

    const overlap = getCategoryTerms(song).filter((term) => categoryTerms.has(term)).length;

    if (!overlap) {
      continue;
    }

    candidates.push({
      song,
      overlap,
      yearDistance: getClosestYearDistance(song, referenceYears)
    });
  }

  const genreYearMatches = candidates
    .sort((a, b) =>
      b.overlap - a.overlap
      || a.yearDistance - b.yearDistance
      || getRankingScore(b.song) - getRankingScore(a.song)
      || a.song.title.localeCompare(b.song.title)
      || a.song.artist.localeCompare(b.song.artist)
    )
    .map((match) => match.song);

  similarSongs = [
    ...artistMatches.sort((a, b) => a.title.localeCompare(b.title)),
    ...genreYearMatches
  ].slice(0, similarLimit);

  similarTitle.textContent = artistMatches.length ? "More by this artist" : "Same genre, nearby years";

  const visibleSimilarSongs = similarSongs.slice(0, Math.max(0, 5 - matches.length));

  if (visibleSimilarSongs.length === 0) {
    return;
  }

  similarBody.innerHTML = renderSongRows(visibleSimilarSongs);
  similarPanel.hidden = false;
}

function render() {
  clearButton.disabled = searchInput.value.length === 0;
  if (catalogState !== "ready") {
    renderCatalogStatus();
    return;
  }
  retrySongsButton.hidden = true;
  resultsSection.setAttribute("aria-busy", "false");
  const query = searchInput.value.trim();
  const normalizedQuery = normalize(query);
  const hasTextQuery = normalizedQuery.length >= minimumSearchLength;
  const hasFilters = activeFilters.length > 0;
  const isBrowseAllResults = isBrowseAllActive && !hasTextQuery && !hasFilters;
  const resultSignature = getResultSignature(query, hasTextQuery, hasFilters);

  if (!hasTextQuery && !hasFilters && !isBrowseAllResults) {
    hideSearchResults();
    return;
  }

  const queryTerms = tokenize(query);
  const rankedMatches = [];
  let matchCount = 0;

  for (const song of songs) {
    if (!songMatchesActiveFilters(song)) {
      continue;
    }

    const score = hasTextQuery
      ? getSearchScore(song, normalizedQuery, queryTerms)
      : 0;

    if (score === null) {
      continue;
    }

    matchCount += 1;

    rankedMatches.push({
      song,
      rank: score
    });
  }

  let usedTypoMatching = false;

  if (hasTextQuery && queryTerms.length && matchCount === 0) {
    const exactMatches = new Set(rankedMatches.map((match) => match.song));
    const fuzzyMatches = [];

    for (const song of songs) {
      if (exactMatches.has(song)) {
        continue;
      }

      if (!songMatchesActiveFilters(song)) {
        continue;
      }

      const rank = fuzzyRank(song, queryTerms);

      if (rank !== null) {
        fuzzyMatches.push({ song, rank });
      }
    }

    fuzzyMatches
      .sort((a, b) => a.rank - b.rank || getRankingScore(b.song) - getRankingScore(a.song) || a.song.title.localeCompare(b.song.title) || a.song.artist.localeCompare(b.song.artist))
      .slice(0, fuzzyResultLimit)
      .forEach((match) => rankedMatches.push({
        song: match.song,
        rank: getSearchScore(match.song, normalizedQuery, queryTerms) ?? 9
      }));

    matchCount = rankedMatches.length;
    usedTypoMatching = fuzzyMatches.length > 0;
  }

  if (matchCount === 0) {
    if (!hasTextQuery && hasFilters) {
      if (resultsSection) {
        resultsSection.hidden = false;
      }
      setDiscoveryVisibility(true);
      resultsBody.innerHTML = "";
      resultsBody.closest("table").hidden = true;
      resultsTitle.textContent = "Filtered songs";
      currentSearchMatches = [];
      currentSearchQuery = "";
      visibleResultCount = maxRenderedRows;
      lastResultSignature = resultSignature;
      if (loadMoreButton) {
        loadMoreButton.hidden = true;
      }
      if (similarPanel) {
        similarPanel.hidden = true;
      }
      emptyState.textContent = "No songs match those filters.";
      emptyState.hidden = false;
      resultCount.textContent = "0 songs";
      updateJumpResultsButton(0);
      updateReturnSearchButton();
      scheduleKaraokeSearchTracking(query, 0);
      return;
    }

    renderRequestSong(query);
    return;
  }

  if (resultsSection) {
    resultsSection.hidden = false;
  }

  setDiscoveryVisibility(true);
  currentSearchQuery = query;
  const nextMatches = dedupeSongs(mixThemeLabelGroups(rankedMatches
    .sort((a, b) => a.rank - b.rank || getRankingScore(b.song) - getRankingScore(a.song) || a.song.title.localeCompare(b.song.title) || a.song.artist.localeCompare(b.song.artist))
    .map((match) => match.song)));
  const signatureChanged = resultSignature !== lastResultSignature;
  currentSearchMatches = nextMatches;

  if (signatureChanged) {
    visibleResultCount = getResultBatchSize();
    lastResultSignature = resultSignature;
  } else {
    visibleResultCount = Math.min(
      Math.max(visibleResultCount, getResultBatchSize()),
      currentSearchMatches.length
    );
  }

  const resultHeading = document.querySelector("#results-title");
  if (resultHeading) {
    resultHeading.textContent = isBrowseAllResults ? "All songs" : hasTextQuery ? "Search results" : "Filtered songs";
  }

  renderVisibleSearchResults(matchCount, usedTypoMatching);
  renderSimilarSongs(matchCount > 0 && matchCount < 5 ? currentSearchMatches : [], query, queryTerms);
  scheduleKaraokeSearchTracking(query, matchCount);
}

function getHeaderIndex(headers, names) {
  return names
    .map((name) => headers.indexOf(normalize(name)))
    .find((index) => index !== -1) ?? -1;
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((items) => items.some((item) => item.trim()));
  const headerRow = nonEmptyRows.shift() || [];
  const headers = headerRow.map((item) => normalize(item));
  const titleIndex = headers.indexOf("title");
  const artistIndex = headers.indexOf("artist");
  const categoriesIndex = headers.indexOf("categories");
  const socialSingingIndex = headers.indexOf("social singing");
  const vibesIndex = getHeaderIndex(headers, ["vibes", "vibe", "vibe tags", "vibe tag"]);
  const versionIndex = getHeaderIndex(headers, ["version", "song version", "specific version", "edition"]);
  const decadeIndex = headers.indexOf("decade");
  const yearIndex = headers.indexOf("year");
  const originalVocalIndex = headers.indexOf("original vocal");
  const themeTagsIndex = getHeaderIndex(headers, ["theme tags", "theme tag", "theme"]);
  const themeLabelsIndex = getHeaderIndex(headers, ["theme labels", "theme label", "sub theme", "subtheme", "sub theme label"]);
  const rankingScoreIndex = headers.includes("popularity score")
    ? headers.indexOf("popularity score")
    : headers.indexOf("popularity");
  if (titleIndex === -1 || artistIndex === -1) {
    throw new Error("CSV must include title and artist columns.");
  }

  return nonEmptyRows.map((items) => ({
    title: items[titleIndex] || "",
    artist: items[artistIndex] || "",
    categories: categoriesIndex === -1 ? "" : items[categoriesIndex] || "",
    vibes: vibesIndex === -1 ? "" : items[vibesIndex] || "",
    socialSinging: socialSingingIndex === -1 ? "" : items[socialSingingIndex] || "",
    version: versionIndex === -1 ? "" : items[versionIndex] || "",
    decade: decadeIndex === -1 ? "" : items[decadeIndex] || "",
    year: yearIndex === -1 ? "" : items[yearIndex] || "",
    originalVocal: originalVocalIndex === -1 ? "" : items[originalVocalIndex] || "",
    themeTags: themeTagsIndex === -1 ? "" : items[themeTagsIndex] || "",
    themeLabels: themeLabelsIndex === -1 ? "" : items[themeLabelsIndex] || "",
    rankingScore: rankingScoreIndex === -1 ? "" : items[rankingScoreIndex] || ""
  }));
}

function parseCsvRecords(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((items) => items.some((item) => item.trim()));
  const headers = (nonEmptyRows.shift() || []).map((item) => normalize(item));

  return nonEmptyRows.map((items) => Object.fromEntries(
    headers.map((header, index) => [header, String(items[index] || "").trim()])
  ));
}

function parseDateOnly(value) {
  const rawValue = String(value || "").trim();
  const isoMatch = rawValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  if (slashMatch) {
    return new Date(Number(slashMatch[3]), Number(slashMatch[1]) - 1, Number(slashMatch[2]));
  }

  return null;
}

function getRecordValue(record, ...keys) {
  for (const key of keys) {
    const normalizedKey = normalize(key);

    if (Object.prototype.hasOwnProperty.call(record, normalizedKey)) {
      return record[normalizedKey];
    }
  }

  return "";
}

function getRecordNumber(record, ...keys) {
  const value = Number(getRecordValue(record, ...keys));

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function getThemeRecordValue(record, key) {
  return getRecordValue(record, key, key.split("_").join(" "));
}

function getThemeRecordDate(record, key) {
  return parseDateOnly(getThemeRecordValue(record, key));
}

function getThemeRecordActive(record) {
  return isThemeActive(getThemeRecordValue(record, "active"));
}

function getThemeRecordNumber(record, key) {
  const normalizedKey = key.split("_").join(" ");
  const value = getRecordNumber(record, key, normalizedKey);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function getThemeRecordText(record, key) {
  return getThemeRecordValue(record, key);
}

function getThemeRecordFilterType(record) {
  const explicitType = getThemeRecordText(record, "filter_type");

  if (explicitType) {
    return explicitType;
  }

  if (getThemeRecordText(record, "theme_tag") || getThemeRecordText(record, "theme_tags")) {
    return "theme_tag";
  }

  if (getThemeRecordText(record, "vibe_tag") || getThemeRecordText(record, "vibe_tags") || getThemeRecordText(record, "vibes")) {
    return "vibe_tag";
  }

  return "theme_tag";
}

function getThemeRecordFilterValue(record) {
  return getThemeRecordText(record, "filter_value")
    || getThemeRecordText(record, "theme_tag")
    || getThemeRecordText(record, "theme_tags")
    || getThemeRecordText(record, "vibe_tag")
    || getThemeRecordText(record, "vibe_tags")
    || getThemeRecordText(record, "vibes")
    || getThemeRecordText(record, "theme_slug");
}

function getThemeRecordDisplayOrder(record) {
  return getThemeRecordNumber(record, "display_order");
}

function getThemeRecordImageFilename(record) {
  return getThemeRecordText(record, "image_filename");
}

function getThemeRecordAltText(record) {
  return getThemeRecordText(record, "alt_text") || getThemeRecordText(record, "theme_name");
}

function getThemeRecordButtonLabel(record) {
  const themeName = getThemeRecordText(record, "theme_name");

  return getThemeRecordText(record, "button_label") || `View ${themeName} Songs`;
}

function getThemeRecordDescription(record) {
  return getThemeRecordText(record, "description");
}

function getThemeRecordName(record) {
  return getThemeRecordText(record, "theme_name");
}

function getThemeRecordSlug(record) {
  return getThemeRecordText(record, "theme_slug");
}

function getThemeRecordEndDate(record, eventDate) {
  return getThemeRecordDate(record, "end_date") || eventDate;
}

function getThemeRecordEventDate(record) {
  return getThemeRecordDate(record, "event_date");
}

function parseThemeRecord(record) {
  const eventDate = getThemeRecordEventDate(record);
  const themeName = getThemeRecordName(record);

  if (!getThemeRecordActive(record)) {
    return null;
  }

  return {
    slug: getThemeRecordSlug(record),
    name: themeName,
    eventDate,
    endDate: getThemeRecordEndDate(record, eventDate),
    buttonLabel: getThemeRecordButtonLabel(record),
    description: getThemeRecordDescription(record),
    imageFilename: getThemeRecordImageFilename(record),
    altText: getThemeRecordAltText(record),
    filterType: getThemeRecordFilterType(record),
    filterValue: getThemeRecordFilterValue(record),
    displayOrder: getThemeRecordDisplayOrder(record)
  };
}

function getTodayLocalDate() {
  const now = new Date();

  if (now.getHours() < 2) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatThemeDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function isThemeActive(value) {
  return ["true", "yes", "1", "active"].includes(normalize(value));
}

function parseThemeDays(csvText) {
  return parseCsvRecords(csvText)
    .map(parseThemeRecord)
    .filter(Boolean)
    .filter((theme) => theme.slug && theme.name && theme.eventDate && theme.endDate);
}

function sortThemes(a, b) {
  return a.eventDate - b.eventDate || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);
}

function getThemeFilter(theme) {
  const filterType = normalize(theme.filterType).replace(/\s/g, "_");

  if (filterType === "vibe_tag" || filterType === "vibe_tags" || filterType === "vibes") {
    return {
      field: "vibes",
      value: theme.filterValue,
      label: theme.name,
      matcher: "vibeTag"
    };
  }

  if (filterType !== "theme_tag" && filterType !== "theme_tags" && filterType !== "theme") {
    return null;
  }

  return {
    field: "themeTags",
    value: theme.filterValue,
    label: theme.name,
    matcher: "themeTag"
  };
}

function updateThemeClearButton() {
  if (!themeClearButton) {
    return;
  }

  themeClearButton.hidden = !activeFilters.some((filter) =>
    filter.field === "themeTags" || filter.field === "vibes"
  );
}

function applyThemeFilter(theme) {
  const filter = getThemeFilter(theme);

  if (!filter) {
    return;
  }

  activeFilters = activeFilters.filter((item) =>
    item.field !== "themeTags" && item.field !== "vibes" && item.field !== "themeLabel"
  );
  setBrowseAllActive(false);
  activeFilters.push(filter);
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  render();
  renderThemeLabelButtons();
}

function clearThemeFilter() {
  activeFilters = activeFilters.filter((filter) =>
    filter.field !== "themeTags" && filter.field !== "vibes" && filter.field !== "themeLabel"
  );
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  render();
  renderThemeLabelButtons();
}

function setThemeLabelFilter(label) {
  if (!getActiveThemeSlug() || !label) {
    return;
  }

  const existingFilter = getActiveThemeLabelFilter();

  setBrowseAllActive(false);
  activeFilters = activeFilters.filter((filter) => filter.field !== "themeLabel");

  if (!existingFilter || normalize(existingFilter.value) !== normalize(label)) {
    activeFilters.push({
      field: "themeLabel",
      value: label,
      label,
      matcher: "themeLabel"
    });
  }

  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  render();
  renderThemeLabelButtons();
}

function getThemeBySlug(slug) {
  const normalizedSlug = normalize(slug);

  return window.overlandThemes?.[slug]
    || themesLoaded.find((theme) => normalize(theme.slug) === normalizedSlug)
    || null;
}

function getQueryValue(params, names) {
  for (const name of names) {
    const value = params.get(name);

    if (value) {
      return value.trim();
    }
  }

  return "";
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const themeSlug = getQueryValue(params, ["theme", "theme_slug", "themeSlug"]);
  const themeLabel = getQueryValue(params, ["themeLabel", "theme_label", "subtheme", "sub_theme"]);

  if (!themeSlug) {
    return null;
  }

  const theme = getThemeBySlug(themeSlug);

  if (!theme) {
    return null;
  }

  applyThemeFilter(theme);

  if (themeLabel) {
    setThemeLabelFilter(themeLabel);
  }

  return theme;
}

async function scrollToThemeSection() {
  if (!themeSection || themeSection.hidden) {
    return;
  }

  await waitForPaint();
  scrollElementIntoSafeView(themeSection);
}

function renderThemeButton(button, theme) {
  button.textContent = "";
  button.setAttribute("aria-label", theme.buttonLabel);

  if (theme.imageFilename) {
    const image = document.createElement("img");
    const label = document.createElement("span");

    image.src = `/assets/theme-buttons/${theme.imageFilename}`;
    image.alt = theme.altText;
    image.addEventListener("error", () => {
      button.textContent = theme.buttonLabel;
    }, { once: true });
    label.className = "theme-button-label";
    label.textContent = theme.buttonLabel;
    button.append(image);
    button.append(label);
  } else {
    button.textContent = theme.buttonLabel;
  }
}

function renderUpcomingThemes(themes, primaryTheme) {
  if (!upcomingThemes || !upcomingThemeList) {
    return;
  }

  const upcoming = themes
    .filter((theme) => theme.eventDate > getTodayLocalDate() && theme.slug !== primaryTheme.slug)
    .sort(sortThemes)
    .slice(0, 3);

  upcomingThemes.hidden = upcoming.length === 0;
  upcomingThemeList.innerHTML = upcoming.map((theme) => `
    <div class="upcoming-theme-item">
      <span>${escapeHtml(formatThemeDate(theme.eventDate))}</span>
      <strong>${escapeHtml(theme.name)}</strong>
      <button class="theme-mini-button" type="button" data-theme-slug="${escapeHtml(theme.slug)}">View Songs</button>
    </div>
  `).join("");
}

function renderThemeDays(themes) {
  if (!themeSection || !themeButton || !themeTitle || !themeDate || !themeDescription || !themeKicker) {
    return;
  }

  const today = getTodayLocalDate();
  const currentThemes = themes
    .filter((theme) => today >= theme.eventDate && today <= theme.endDate)
    .sort((a, b) => a.displayOrder - b.displayOrder || sortThemes(a, b));
  const futureThemes = themes
    .filter((theme) => theme.eventDate > today)
    .sort(sortThemes);
  const primaryTheme = currentThemes[0] || futureThemes[0];

  if (!primaryTheme) {
    themeSection.hidden = true;
    return;
  }

  themeSection.hidden = false;
  themeKicker.textContent = currentThemes.length ? "Tonight's Theme" : "Next Theme Day";
  themeTitle.textContent = `${themeKicker.textContent}: ${primaryTheme.name}`;
  themeDate.textContent = formatThemeDate(primaryTheme.eventDate);
  themeDescription.textContent = primaryTheme.description || "";
  themeButton.dataset.themeSlug = primaryTheme.slug;
  renderThemeButton(themeButton, primaryTheme);
  renderUpcomingThemes(themes, primaryTheme);
  renderThemeLabelButtons();
}

async function loadThemeDays() {
  try {
    const response = await fetch(themeDaysUrl);

    if (!response.ok) {
      throw new Error("Theme days CSV was not available.");
    }

    const themes = parseThemeDays(await response.text());
    themesLoaded = themes;
    window.overlandThemes = Object.fromEntries(themes.map((theme) => [theme.slug, theme]));
    renderThemeDays(themes);
    return themes;
  } catch {
    themesLoaded = [];
    if (themeSection) {
      themeSection.hidden = true;
    }
    return [];
  }
}

function setSongs(nextSongs) {
  songs = indexSongs(nextSongs);
  setPreparedSongs(songs);
}

function setPreparedSongs(nextSongs) {
  songs = nextSongs;
  buildGenreOptions(songs);
  diceButtons.forEach((button) => {
    button.disabled = songs.length === 0;
  });
  renderTopSongs();
  updateBrowseButtonStates();
  catalogState = "ready";
  catalogStatus.textContent = `${songs.length.toLocaleString()} songs in the book`;
  render();
  renderThemeLabelButtons();
  const shouldJump = pendingResultsJump;
  pendingResultsJump = false;
  if (shouldJump) {
    showResults({ keepTyping: shouldJump === "typing" });
  }
}

function renderCatalogStatus() {
  const isLoading = catalogState === "loading";
  const hasIntent = searchInput.value.trim() || activeFilters.length || isBrowseAllActive;
  resultsSection.hidden = isLoading && !hasIntent;
  resultsSection.setAttribute("aria-busy", isLoading ? "true" : "false");
  resultsTitle.textContent = isLoading ? "Loading songs" : "Song book unavailable";
  resultsBody.innerHTML = "";
  resultsBody.closest("table").hidden = true;
  emptyState.textContent = isLoading ? "Loading the song book..." : "The song book couldn't load. Check your connection and try again.";
  emptyState.hidden = false;
  resultCount.textContent = "";
  loadMoreButton.hidden = true;
  retrySongsButton.hidden = isLoading;
  similarPanel.hidden = true;
  topSongsPanel.hidden = true;
  setDiscoveryVisibility(!resultsSection.hidden);
  updateJumpResultsButton();
}

async function loadInitialSongs() {
  catalogState = "loading";
  catalogStatus.textContent = "Loading the song book...";
  renderCatalogStatus();
  try {
    for (const url of [songIndexUrl, songCsvUrl, "data/songs.csv"]) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          continue;
        }
        await waitForPaint();
        const prepared = url === songIndexUrl
          ? hydrateIndexedSongs(await response.json())
          : indexSongs(parseCsv(await response.text()));
        if (!prepared.length) {
          continue;
        }
        setPreparedSongs(prepared);
        return songs;
      } catch {
        // A failed index still permits the existing CSV fallback.
      }
    }
    throw new Error("Song catalog unavailable.");
  } catch {
    catalogState = "error";
    songs = [];
    diceButtons.forEach((button) => {
      button.disabled = true;
    });
    catalogStatus.textContent = "Song book unavailable. Please try again.";
    renderCatalogStatus();
    return [];
  }
}

function handleSearchInput(event) {
  window.clearTimeout(resultsJumpTimer);
  pendingResultsJump = false;
  if (searchInput.value.trim()) {
    setBrowseAllActive(false);
  }
  window.clearTimeout(searchTimer);
  if (event?.isComposing) {
    return;
  }
  searchTimer = window.setTimeout(() => {
    if (normalize(searchInput.value)) {
      showResults({ keepTyping: true });
    } else {
      render();
    }
  }, 80);
}

searchInput.addEventListener("input", handleSearchInput);
searchInput.addEventListener("compositionend", handleSearchInput);

document.addEventListener("click", (event) => {
  const trackedElement = event.target.closest("[data-analytics-event]");

  if (trackedElement) {
    trackAnalyticsElement(trackedElement);
  }

  const filterCategoryButton = event.target.closest(".filter-category-button");

  if (filterCategoryButton) {
    const section = filterCategoryButton.dataset.filterSection || "";
    activeFilterSection = activeFilterSection === section ? "" : section;
    updateBrowseButtonStates();
    return;
  }

  const activeFilterChip = event.target.closest(".active-filter-chip");

  if (activeFilterChip) {
    removeFilter(activeFilterChip.dataset.removeField || "", activeFilterChip.dataset.removeValue || "");
    window.clearTimeout(searchTimer);
    render();
    return;
  }

  const genreMoreButton = event.target.closest(".genre-more-button");

  if (genreMoreButton) {
    visibleGenreCount = Math.min(genreOptions.length, visibleGenreCount + 10);
    updateBrowseButtonStates();
    return;
  }

  const subgenreMoreButton = event.target.closest(".subgenre-more-button");

  if (subgenreMoreButton) {
    visibleSubgenreCount = Math.min(40, visibleSubgenreCount + 10);
    updateBrowseButtonStates();
    return;
  }

  const button = event.target.closest(".browse-button");

  if (button) {
    setFilterFromButton(button);
    window.clearTimeout(searchTimer);
    render();
  }

  const songRow = event.target.closest(".song-row");

  if (songRow && !event.target.closest(".song-theme-label")) {
    openSongDialog(songRow);
    if (songRow.classList.contains("dice-song-row")) {
      setDicePanelOpen(false);
    }
  }

  const themeMiniButton = event.target.closest(".theme-mini-button");

  if (themeMiniButton) {
    const theme = window.overlandThemes?.[themeMiniButton.dataset.themeSlug];

    if (theme) {
      applyThemeFilter(theme);
    }
  }

  const themeLabelButton = event.target.closest(".song-theme-label");

  if (themeLabelButton) {
    setThemeLabelFilter(themeLabelButton.dataset.themeLabel || themeLabelButton.textContent.trim());
  }
});

if (themeButton) {
  themeButton.addEventListener("click", () => {
    const theme = window.overlandThemes?.[themeButton.dataset.themeSlug];

    if (theme) {
      applyThemeFilter(theme);
    }
  });
}

if (themeClearButton) {
  themeClearButton.addEventListener("click", clearThemeFilter);
}

if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", () => {
    clearFilters();
    window.clearTimeout(searchTimer);
    render();
  });
}

if (browseAllButton) {
  browseAllButton.addEventListener("click", () => {
    searchInput.value = "";
    clearFilters();
    setBrowseAllActive(!isBrowseAllActive);
    window.clearTimeout(searchTimer);
    showResults();
  });
}

if (jumpResultsButton) {
  jumpResultsButton.addEventListener("click", () => {
    showResults();
  });
}

searchInput.addEventListener("search", () => {
  render();
});
emptyState.addEventListener("pointerdown", handleRequestSongActivation);
emptyState.addEventListener("click", handleRequestSongActivation);

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.isComposing) {
      return;
    }
    showResults();
  });
}

clearButton.addEventListener("click", () => {
  window.clearTimeout(resultsJumpTimer);
  pendingResultsJump = false;
  window.clearTimeout(searchTimer);
  searchInput.value = "";
  searchInput.focus();
  render();
});

if (loadMoreButton) {
  loadMoreButton.addEventListener("click", () => {
    if (loadMoreButton.disabled || visibleResultCount >= currentSearchMatches.length) {
      return;
    }

    const previousScrollY = window.scrollY;
    loadMoreButton.disabled = true;
    visibleResultCount = Math.min(currentSearchMatches.length, visibleResultCount + getResultBatchSize());
    renderVisibleSearchResults(currentSearchMatches.length, currentUsedTypoMatching, true);
    if (loadMoreButton.hidden) {
      resultsBody.lastElementChild?.querySelector(".song-select-button")?.focus({ preventScroll: true });
    }
    window.scrollTo({ top: previousScrollY, behavior: "auto" });
  });
}

if (topDiceButton) {
  topDiceButton.addEventListener("click", () => {
    const willOpen = dicePanel?.hidden;

    if (!willOpen) {
      setDicePanelOpen(false, { restoreFocus: true });
      return;
    }

    if (!hasRolledDice) {
      rollDiceSuggestions();
    }

    setDicePanelOpen(true);
  });
}

if (diceButton) {
  diceButton.addEventListener("click", () => {
    rollDiceSuggestions();
    setDicePanelOpen(true);
  });
}

diceCloseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDicePanelOpen(false, { restoreFocus: true });
  });
});

if (returnSearchButton) {
  returnSearchButton.addEventListener("click", () => {
    window.clearTimeout(resultsJumpTimer);
    scrollElementIntoSafeView(searchControls);
    searchInput.focus({ preventScroll: true });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && songDialog?.open) {
    return;
  }
  if (event.key === "Escape" && dicePanel && !dicePanel.hidden) {
    setDicePanelOpen(false, { restoreFocus: true });
    return;
  }

  if (event.key === "Escape" && navToggle?.getAttribute("aria-expanded") === "true") {
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.focus({ preventScroll: true });
  }
});

retrySongsButton?.addEventListener("click", () => {
  pendingResultsJump = true;
  loadInitialSongs();
});
navToggle?.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  navToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) {
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

if (songDialog) {
  songDialog.addEventListener("close", restoreDialogFocus);
  songDialog.addEventListener("click", (event) => {
    if (event.target === songDialog) {
      songDialog.close();
    }
  });
}

window.addEventListener("resize", updateReturnSearchButton);

if (typeof ResizeObserver === "function") {
  const header = document.querySelector(".site-header");
  const stickyObserver = new ResizeObserver(() => {
    document.body.style.setProperty("--header-height", `${header.offsetHeight}px`);
    document.body.style.setProperty("--search-height", `${searchForm.offsetHeight}px`);
  });
  stickyObserver.observe(header);
  stickyObserver.observe(searchForm);
}

async function initializePage() {
  await Promise.all([
    loadInitialSongs(),
    loadThemeDays()
  ]);
  const urlTheme = applyUrlFilters();

  if (urlTheme) {
    await scrollToThemeSection();
  }
}

initializePage();
