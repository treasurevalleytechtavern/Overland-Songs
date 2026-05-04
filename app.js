const maxRenderedRows = 15;
const minimumSearchLength = 2;
const fuzzyResultLimit = 80;
const requestSongUrl = "https://overlandbar.com/request-a-song";
const songIndexUrl = "songs.index.json?v=20260504-theme-top10";
const songCsvUrl = "songs.csv?v=20260504-theme-top10";
const themeDaysUrl = "theme_days.csv?v=20260504-theme-top10";

const searchForm = document.querySelector("#song-search-form");
const searchInput = document.querySelector("#song-search");
const clearButton = document.querySelector("#clear-search");
let browseButtons = document.querySelectorAll(".browse-button");
const filterSummary = document.querySelector("#filter-summary");
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
const diceResults = document.querySelector("#dice-results");
const diceFemaleResults = document.querySelector("#dice-female-results");
const diceMaleResults = document.querySelector("#dice-male-results");
const themeSection = document.querySelector("#theme-section");
const themeKicker = document.querySelector("#theme-kicker");
const themeTitle = document.querySelector("#theme-title");
const themeDate = document.querySelector("#theme-date");
const themeDescription = document.querySelector("#theme-description");
const themeButton = document.querySelector("#theme-button");
const themeClearButton = document.querySelector("#theme-clear-button");
const upcomingThemes = document.querySelector("#upcoming-themes");
const upcomingThemeList = document.querySelector("#upcoming-theme-list");
const topSongsPanel = document.querySelector("#top-songs-panel");
const topSongsBody = document.querySelector("#top-songs-results");

let songs = [];
let searchTimer = 0;
let requestNavigationStarted = false;
let activeFilters = [];
let currentSearchMatches = [];
let currentSearchQuery = "";
let visibleResultCount = maxRenderedRows;
let currentUsedTypoMatching = false;

const diceButtons = [topDiceButton, diceButton].filter(Boolean);
diceButtons.forEach((button) => {
  button.disabled = true;
});

function updateHeaderScrollState() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 4);
}

window.addEventListener("scroll", updateHeaderScrollState, { passive: true });
updateHeaderScrollState();

const filterFieldLabels = {
  categories: "Genre",
  categoryDetail: "Sub-genre",
  decade: "Decade",
  originalVocal: "Original vocal",
  socialSinging: "Social singing",
  themeTags: "Theme"
};

const HIGH_LEVEL_GENRES = [
  {
    label: "Rock",
    slug: "rock",
    categories: [
      "Rock",
      "Alternative Rock",
      "Classic Rock",
      "Hard Rock",
      "Indie Rock",
      "Pop Rock",
      "Soft Rock",
      "Country Rock",
      "Blues Rock",
      "Folk Rock",
      "Southern Rock",
      "Post-Grunge",
      "Grunge",
      "Progressive Rock",
      "Psychedelic Rock",
      "Britpop",
      "Garage Rock",
      "Glam Rock",
      "Heartland Rock",
      "Funk Rock",
      "Power Pop",
      "Yacht Rock",
      "Roots Rock",
      "Rock and Roll",
      "Gothic Rock",
      "Christian Rock",
      "Latin Rock",
      "New Wave",
      "Post-Punk",
      "Industrial Rock",
      "Rap Rock",
      "Punk Rock",
      "Pop Punk",
      "Ska Punk"
    ]
  },
  {
    label: "Pop",
    slug: "pop",
    categories: [
      "Pop",
      "Pop Rock",
      "Country Pop",
      "Dance-Pop",
      "Adult Contemporary",
      "Soft Rock",
      "Teen Pop",
      "Electropop",
      "Indie Pop",
      "Synth-Pop",
      "Folk Pop",
      "Art Pop",
      "Baroque Pop",
      "Power Pop",
      "Boy Band",
      "Dream Pop",
      "Traditional Pop"
    ]
  },
  {
    label: "Country",
    slug: "country",
    categories: [
      "Country",
      "Country Pop",
      "Country Rock",
      "Alt-Country",
      "Americana",
      "Bluegrass",
      "Southern Rock",
      "Heartland Rock",
      "Roots Rock",
      "Country Rap"
    ]
  },
  {
    label: "Folk / Americana",
    slug: "folk-americana",
    categories: [
      "Folk",
      "Americana",
      "Singer-Songwriter",
      "Folk Rock",
      "Folk Pop",
      "Indie Folk",
      "Alt-Country",
      "Bluegrass",
      "Roots Rock"
    ]
  },
  {
    label: "R&B / Soul / Funk",
    slug: "rnb-soul-funk",
    categories: [
      "R&B",
      "Soul",
      "Funk",
      "Motown",
      "New Jack Swing",
      "Gospel",
      "Funk Rock"
    ]
  },
  {
    label: "Dance / Electronic",
    slug: "dance-electronic",
    categories: [
      "Dance",
      "Dance-Pop",
      "Disco",
      "Electronic",
      "Electropop",
      "Synth-Pop",
      "EDM",
      "Electro",
      "Electro House",
      "House",
      "Eurodance",
      "New Wave"
    ]
  },
  {
    label: "Blues",
    slug: "blues",
    categories: [
      "Blues",
      "Blues Rock"
    ]
  },
  {
    label: "Metal",
    slug: "metal",
    categories: [
      "Metal",
      "Heavy Metal",
      "Alternative Metal",
      "Glam Metal",
      "Nu Metal",
      "Metalcore",
      "Industrial Rock"
    ]
  },
  {
    label: "Punk / Emo / Ska",
    slug: "punk-emo-ska",
    categories: [
      "Punk",
      "Punk Rock",
      "Pop Punk",
      "Emo",
      "Ska",
      "Ska Punk",
      "Post-Punk",
      "New Wave"
    ]
  },
  {
    label: "Hip-Hop / Rap",
    slug: "hip-hop-rap",
    categories: [
      "Hip-Hop",
      "Pop Rap",
      "Rap Rock",
      "Trap",
      "Country Rap"
    ]
  }
];

const HIGH_LEVEL_GENRE_MAP = Object.fromEntries(
  HIGH_LEVEL_GENRES.map((genre) => [
    genre.slug,
    genre.categories.map((category) => normalize(category))
  ])
);

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

function songHasThemeTag(song, slug) {
  return getThemeTags(song.themeTags).some((tag) => tag === slug);
}

function getActiveThemeSlug() {
  return activeFilters.find((filter) => filter.matcher === "themeTag")?.value || "";
}

function getThemeLabelForSong(song, slug) {
  if (!slug) {
    return "";
  }

  return String(song.themeLabels || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
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
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(resolve);
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
    song.socialSinging,
    song.decade,
    ...decadeAliases,
    song.year,
    song.originalVocal
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

function categoryBucketMatches(song, categoryTerms) {
  const categoryText = normalize(song.categories);
  const categorySegments = String(song.categories || "")
    .split("|")
    .map((segment) => normalize(segment))
    .filter(Boolean);

  return categoryTerms.some((category) =>
    categorySegments.includes(category) || categoryText.includes(category)
  );
}

function getActiveGenreFilter() {
  return activeFilters.find((filter) => filter.field === "categories") || null;
}

function clearGenreFilters() {
  activeFilters = activeFilters.filter((filter) =>
    filter.field !== "categories" && filter.field !== "categoryDetail"
  );
}

function getFilterLabel(fieldName) {
  return filterFieldLabels[fieldName] || fieldName;
}

function songMatchesFilter(song, filter) {
  if (filter.matcher === "themeTag") {
    return songHasThemeTag(song, filter.value);
  }

  if (filter.matcher === "categoryBucket") {
    return categoryBucketMatches(song, filter.categoryTerms || []);
  }

  if (filter.matcher === "categoryExact") {
    return categoryBucketMatches(song, [normalize(filter.value)]);
  }

  return fieldMatchesQuery(song, filter.field, tokenize(filter.value));
}

function songMatchesActiveFilters(song) {
  return activeFilters.every((filter) => songMatchesFilter(song, filter));
}

function updateFilterSummary() {
  if (!filterSummary) {
    return;
  }

  if (activeFilters.length === 0) {
    filterSummary.hidden = true;
    filterSummary.textContent = "";
    return;
  }

  filterSummary.textContent = activeFilters
    .map((filter) => `${getFilterLabel(filter.field)}: ${filter.label}`)
    .join("; ");
  filterSummary.hidden = false;
}

function updateBrowseButtonStates() {
  const activeGenre = getActiveGenreFilter();

  if (subgenrePanel && subgenreButtons) {
    subgenrePanel.hidden = !activeGenre;
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
}

function renderSubgenreButtons(activeGenre) {
  if (!subgenreButtons) {
    return;
  }

  const genre = HIGH_LEVEL_GENRES.find((item) => item.slug === activeGenre?.value);

  if (!genre) {
    subgenreButtons.innerHTML = "";
    return;
  }

  subgenreButtons.innerHTML = genre.categories.map((category) => `
    <button
      class="browse-button subgenre-button"
      type="button"
      data-search="${escapeHtml(category)}"
      data-field="categoryDetail"
      data-matcher="categoryExact"
    >${escapeHtml(category)}</button>
  `).join("");
}

function setFilterFromButton(button) {
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

  const isDuetFilter = field === "socialSinging" && normalize(value).replace(/\s/g, "") === "duets";
  const isOriginalVocalFilter = field === "originalVocal";

  if (isDuetFilter) {
    activeFilters = activeFilters.filter((filter) => filter.field !== "originalVocal");
  } else if (isOriginalVocalFilter) {
    activeFilters = activeFilters.filter((filter) =>
      !(filter.field === "socialSinging" && normalize(filter.value).replace(/\s/g, "") === "duets")
    );
  }

  if (field === "categories") {
    activeFilters = activeFilters.filter((filter) => filter.field !== "categoryDetail");
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
      matcher: button.dataset.matcher || "",
      categoryTerms: HIGH_LEVEL_GENRE_MAP[value] || []
    });
  } else {
    activeFilters[existingIndex] = {
      field,
      value,
      label: button.textContent.trim(),
      matcher: button.dataset.matcher || "",
      categoryTerms: HIGH_LEVEL_GENRE_MAP[value] || []
    };
  }

  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
}

function clearFilters() {
  activeFilters = [];
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
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
      const socialSinging = String(song.socialSinging || "").trim();
      const originalVocal = String(song.originalVocal || "").trim();
      const year = String(song.year || "").trim();
      const decade = String(song.decade || "").trim() || deriveDecadeFromYear(year);
      const themeTags = String(song.themeTags || "").trim();
      const themeLabels = String(song.themeLabels || "").trim();
      const rankingScore = parseRankingScore(song.rankingScore);
      const searchPieces = getSearchPieces({ title, artist, categories, socialSinging, decade, year, originalVocal });
      const searchText = normalize(searchPieces.join(" "));
      const compactFields = [
        normalize(title).replace(/\s/g, ""),
        normalize(artist).replace(/\s/g, ""),
        ...getArtistAliases(artist).map((alias) => normalize(alias).replace(/\s/g, "")),
        normalize(categories).replace(/\s/g, ""),
        normalize(socialSinging).replace(/\s/g, ""),
        normalize(decade).replace(/\s/g, ""),
        normalize(year).replace(/\s/g, ""),
        normalize(originalVocal).replace(/\s/g, "")
      ].filter(Boolean);

      return {
        title,
        artist,
        categories,
        socialSinging,
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
      const searchPieces = getSearchPieces({ title, artist, categories, socialSinging, decade, year, originalVocal });
      const searchText = String(row[3] || normalize(searchPieces.join(" ")));
      const compactFields = compactFieldSource
        ? compactFieldSource
        : [normalize(title).replace(/\s/g, ""), normalize(artist).replace(/\s/g, ""), normalize(categories).replace(/\s/g, ""), normalize(socialSinging).replace(/\s/g, ""), normalize(decade).replace(/\s/g, ""), normalize(year).replace(/\s/g, ""), normalize(originalVocal).replace(/\s/g, "")].filter(Boolean);
      const fuzzyTerms = fuzzyTermSource
        ? fuzzyTermSource
        : Array.from(new Set(tokenize(searchPieces.join(" "))));

      return {
        title,
        artist,
        categories,
        socialSinging,
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
  const requestUrl = `${requestSongUrl}?song=${encodeURIComponent(query)}`;
  if (resultsSection) {
    resultsSection.hidden = false;
  }
  resultsBody.innerHTML = "";
  currentSearchMatches = [];
  currentSearchQuery = "";
  visibleResultCount = maxRenderedRows;
  if (loadMoreButton) {
    loadMoreButton.hidden = true;
  }
  if (similarPanel) {
    similarPanel.hidden = true;
  }
  emptyState.innerHTML = `
    <span>No songs found for "${escapeHtml(query)}".</span>
    <a class="request-song-button" href="${requestUrl}" target="_top">Request a song</a>
  `;
  emptyState.hidden = false;
  resultCount.textContent = "0 songs";
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

  resultsBody.innerHTML = "";
  emptyState.hidden = true;
  currentSearchMatches = [];
  currentSearchQuery = "";
  visibleResultCount = maxRenderedRows;
  if (loadMoreButton) {
    loadMoreButton.hidden = true;
  }
  resultCount.textContent = songs.length ? `${songs.length.toLocaleString()} songs loaded` : "Loading songs...";

  if (similarPanel) {
    similarPanel.hidden = true;
  }
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
  const candidates = songs.filter((song) => normalize(song.originalVocal) === vocalKey);

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = candidates[index];
    candidates[index] = candidates[swapIndex];
    candidates[swapIndex] = current;
  }

  return candidates.slice(0, limit);
}

function renderDiceList(target, songList) {
  if (!target) {
    return;
  }

  target.innerHTML = songList.map((song) => `
    <li>
      <span class="dice-song-title">${escapeHtml(song.title)}</span>
      <span class="dice-song-artist">${escapeHtml(song.artist)}</span>
    </li>
  `).join("");
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
      ? `<span class="song-theme-label">${escapeHtml(themeLabel)}</span>`
      : "";

    return `
    <tr>
      <td data-label="Title">
        <span class="song-cell-content">
          <span>${query ? highlight(song.title, query) : escapeHtml(song.title)}</span>
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

function renderVisibleSearchResults(matchCount, usedTypoMatching) {
  currentUsedTypoMatching = usedTypoMatching;
  const visibleMatches = currentSearchMatches.slice(0, visibleResultCount);
  const visibleCount = visibleMatches.length;
  const totalPages = Math.max(1, Math.ceil(currentSearchMatches.length / maxRenderedRows));
  const currentPage = Math.max(1, Math.ceil(visibleCount / maxRenderedRows));

  resultsBody.innerHTML = renderSongRows(visibleMatches, currentSearchQuery);

  if (loadMoreButton) {
    loadMoreButton.hidden = visibleResultCount >= currentSearchMatches.length;
    loadMoreButton.textContent = `Show next ${Math.min(maxRenderedRows, Math.max(0, currentSearchMatches.length - visibleResultCount)).toLocaleString()}`;
  }

  emptyState.hidden = true;
  const shownText = `, showing 1-${visibleCount.toLocaleString()} of ${currentSearchMatches.length.toLocaleString()}, page ${currentPage.toLocaleString()} of ${totalPages.toLocaleString()}`;
  const typoText = usedTypoMatching ? " including close matches" : "";
  resultCount.textContent = `${matchCount.toLocaleString()} song${matchCount === 1 ? "" : "s"}${typoText}${shownText}`;
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
  const query = searchInput.value.trim();
  const normalizedQuery = normalize(query);
  const hasTextQuery = normalizedQuery.length >= minimumSearchLength;
  const hasFilters = activeFilters.length > 0;

  if (!hasTextQuery && !hasFilters) {
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
      resultsBody.innerHTML = "";
      currentSearchMatches = [];
      currentSearchQuery = "";
      visibleResultCount = maxRenderedRows;
      if (loadMoreButton) {
        loadMoreButton.hidden = true;
      }
      if (similarPanel) {
        similarPanel.hidden = true;
      }
      emptyState.textContent = "No songs match those filters.";
      emptyState.hidden = false;
      resultCount.textContent = "0 songs";
      return;
    }

    renderRequestSong(query);
    return;
  }

  if (resultsSection) {
    resultsSection.hidden = false;
  }

  currentSearchQuery = query;
  visibleResultCount = maxRenderedRows;
  currentSearchMatches = rankedMatches
    .sort((a, b) => a.rank - b.rank || getRankingScore(b.song) - getRankingScore(a.song) || a.song.title.localeCompare(b.song.title) || a.song.artist.localeCompare(b.song.artist))
    .map((match) => match.song);

  renderVisibleSearchResults(matchCount, usedTypoMatching);
  renderSimilarSongs(matchCount > 0 && matchCount < 5 ? currentSearchMatches : [], query, queryTerms);
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
  const decadeIndex = headers.indexOf("decade");
  const yearIndex = headers.indexOf("year");
  const originalVocalIndex = headers.indexOf("original vocal");
  const themeTagsIndex = headers.indexOf("theme tags");
  const themeLabelsIndex = headers.indexOf("theme labels");
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
    socialSinging: socialSingingIndex === -1 ? "" : items[socialSingingIndex] || "",
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
  return getThemeRecordText(record, "filter_type");
}

function getThemeRecordFilterValue(record) {
  return getThemeRecordText(record, "filter_value") || getThemeRecordText(record, "theme_slug");
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
  if (theme.filterType !== "theme_tag") {
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

  themeClearButton.hidden = !activeFilters.some((filter) => filter.field === "themeTags");
}

function applyThemeFilter(theme) {
  const filter = getThemeFilter(theme);

  if (!filter) {
    return;
  }

  activeFilters = activeFilters.filter((item) => item.field !== "themeTags");
  activeFilters.push(filter);
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  render();
  resultsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearThemeFilter() {
  activeFilters = activeFilters.filter((filter) => filter.field !== "themeTags");
  updateFilterSummary();
  updateBrowseButtonStates();
  updateThemeClearButton();
  render();
}

function renderThemeButton(button, theme) {
  button.textContent = "";

  if (theme.imageFilename) {
    const image = document.createElement("img");
    image.src = `/assets/theme-buttons/${theme.imageFilename}`;
    image.alt = theme.altText;
    image.addEventListener("error", () => {
      button.textContent = theme.buttonLabel;
    }, { once: true });
    button.append(image);
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
}

async function loadThemeDays() {
  try {
    const response = await fetch(themeDaysUrl);

    if (!response.ok) {
      throw new Error("Theme days CSV was not available.");
    }

    const themes = parseThemeDays(await response.text());
    window.overlandThemes = Object.fromEntries(themes.map((theme) => [theme.slug, theme]));
    renderThemeDays(themes);
  } catch {
    if (themeSection) {
      themeSection.hidden = true;
    }
  }
}

function setSongs(nextSongs) {
  songs = indexSongs(nextSongs);
  setPreparedSongs(songs);
}

function setPreparedSongs(nextSongs) {
  songs = nextSongs;
  diceButtons.forEach((button) => {
    button.disabled = songs.length === 0;
  });
  renderTopSongs();
  updateBrowseButtonStates();
  hideSearchResults();
}

function renderDiceSuggestions() {
  if (!dicePanel || !diceResults) {
    return;
  }

  renderDiceList(diceFemaleResults, getRandomSongsByVocal("female", 5));
  renderDiceList(diceMaleResults, getRandomSongsByVocal("male", 5));
  dicePanel.hidden = false;
  diceResults.hidden = false;
  dicePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadInitialSongs() {
  try {
    let response = await fetch(songIndexUrl);

    if (response.ok) {
      await waitForPaint();
      setPreparedSongs(hydrateIndexedSongs(await response.json()));
      return;
    }

    response = await fetch(songCsvUrl);

    if (!response.ok) {
      response = await fetch("data/songs.csv");
    }

    if (!response.ok) {
      throw new Error("Song CSV was not available.");
    }

    setSongs(parseCsv(await response.text()));
  } catch {
    songs = [];
    diceButtons.forEach((button) => {
      button.disabled = true;
    });
    if (resultsSection) {
      resultsSection.hidden = false;
    }
    resultsBody.innerHTML = "";
    emptyState.textContent = "Song list unavailable. Check songs.csv.";
    emptyState.hidden = false;
    resultCount.textContent = "0 songs";
  }
}

searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(render, 80);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".browse-button");

  if (button) {
    setFilterFromButton(button);
    window.clearTimeout(searchTimer);
    render();
  }

  const themeMiniButton = event.target.closest(".theme-mini-button");

  if (themeMiniButton) {
    const theme = window.overlandThemes?.[themeMiniButton.dataset.themeSlug];

    if (theme) {
      applyThemeFilter(theme);
    }
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

searchInput.addEventListener("search", () => {
  render();
});
searchInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    render();
  }
});

emptyState.addEventListener("pointerdown", handleRequestSongActivation);
emptyState.addEventListener("click", handleRequestSongActivation);

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    render();
  });
}

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  clearFilters();
  searchInput.focus();
  render();
});

if (loadMoreButton) {
  loadMoreButton.addEventListener("click", () => {
    visibleResultCount += maxRenderedRows;
    renderVisibleSearchResults(currentSearchMatches.length, currentUsedTypoMatching);
  });
}

diceButtons.forEach((button) => {
  button.addEventListener("click", renderDiceSuggestions);
});

loadInitialSongs();
loadThemeDays();
