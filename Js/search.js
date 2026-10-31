
"use strict";

const ANILIST_API = "https://graphql.anilist.co";
const PAGE_SIZE = 30;

const SEARCH_QUERY = `
  query (
    $page: Int,
    $perPage: Int,
    $search: String,
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        total
      }
      media(
        type: ANIME
        isAdult: false
        search: $search
        sort: $sort
      ) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        averageScore
        popularity
        episodes
        format
        genres
        seasonYear
        startDate {
          year
        }
        status
      }
    }
  }
`;

const elements = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("searchInput"),
  clearSearch: document.getElementById("clearSearch"),
  heading: document.getElementById("resultsHeading"),
  count: document.getElementById("resultsCount"),
  grid: document.getElementById("resultsGrid"),
  noResults: document.getElementById("noResults"),
  error: document.getElementById("searchError"),
  loadMore: document.getElementById("loadMore"),
  sort: document.getElementById("sortSelect"),
  genre: document.getElementById("genreFilter"),
  format: document.getElementById("formatFilter"),
  year: document.getElementById("yearFilter"),
  status: document.getElementById("statusFilter"),
  applyFilters: document.getElementById("applyFilters"),
  resetFilters: document.getElementById("resetFilters"),
  clearAllFilters: document.getElementById("clearAllFilters"),
  activeFilters: document.getElementById("activeFilters")
};

let searchTerm = "";
let currentPage = 1;
let hasNextPage = false;
let isLoading = false;
let requestId = 0;
let allResults = [];
let filteredResults = [];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function normalizeAnime(item) {
  const year = item.seasonYear || item.startDate?.year || "";

  return {
    id: item.id,
    title:
      item.title?.english ||
      item.title?.romaji ||
      item.title?.native ||
      "Untitled Anime",
    titles: [
      item.title?.english,
      item.title?.romaji,
      item.title?.native
    ].filter(Boolean),
    image:
      item.coverImage?.extraLarge ||
      item.coverImage?.large ||
      "",
    rating: item.averageScore
      ? (item.averageScore / 10).toFixed(1)
      : "N/A",
    popularity: item.popularity || 0,
    year: Number(year) || 0,
    episodes: item.episodes || 0,
    format: item.format || "UNKNOWN",
    genres: item.genres || [],
    status: item.status || "UNKNOWN"
  };
}

async function fetchAnimePage(page, query, sort) {
  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        page,
        perPage: PAGE_SIZE,
        search: query || null,
        sort: [sort]
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList returned HTTP ${response.status}.`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(
      result.errors.map(error => error.message).join("; ")
    );
  }

  const pageData = result.data?.Page;

  if (!pageData || !Array.isArray(pageData.media)) {
    throw new Error("AniList returned an invalid response.");
  }

  return {
    items: pageData.media.map(normalizeAnime),
    pageInfo: pageData.pageInfo
  };
}

function setLoading(loading) {
  isLoading = loading;
  elements.loadMore.disabled = loading;

  elements.loadMore.textContent = loading
    ? "Loading..."
    : "Load More Anime";

  elements.loadMore.hidden = loading || !hasNextPage;
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function clearError() {
  elements.error.textContent = "";
  elements.error.hidden = true;
}

function updateURL() {
  const url = new URL(window.location.href);

  if (searchTerm) {
    url.searchParams.set("q", searchTerm);
  } else {
    url.searchParams.delete("q");
  }

  window.history.replaceState({}, "", url);
}

function updateHeading() {
  elements.heading.textContent = searchTerm
    ? `Results for "${searchTerm}"`
    : "Explore Anime";

  elements.input.value = searchTerm;
  elements.clearSearch.hidden = !searchTerm;

  if (searchTerm) {
    elements.count.textContent = "Finding anime that match your search.";
  } else {
    elements.count.textContent = "Discover popular and trending titles.";
  }
}

async function runSearch({ reset = true } = {}) {
  if (isLoading) return;

  const thisRequest = ++requestId;
  clearError();

  if (reset) {
    currentPage = 1;
    hasNextPage = false;
    allResults = [];
    filteredResults = [];

    elements.grid.innerHTML = `
      <div class="search-loading">
        <span class="loading-spinner"></span>
        <p>Finding anime...</p>
      </div>
    `;

    elements.noResults.hidden = true;
    elements.loadMore.hidden = true;
  }

  setLoading(true);

  try {
    const data = await fetchAnimePage(
      currentPage,
      searchTerm,
      elements.sort.value
    );

    // Ignore an outdated response if a newer search has started.
    if (thisRequest !== requestId) return;

    const existingIds = new Set(allResults.map(anime => anime.id));

    data.items.forEach(anime => {
      if (!existingIds.has(anime.id)) {
        allResults.push(anime);
        existingIds.add(anime.id);
      }
    });

    hasNextPage = Boolean(data.pageInfo?.hasNextPage);

    if (hasNextPage) {
      currentPage += 1;
    }

    applyCurrentFilters();
  } catch (error) {
    if (thisRequest !== requestId) return;

    console.error("Anime search failed:", error);

    if (reset) {
      elements.grid.innerHTML = "";
    }

    showError(
      "We couldn't load anime right now. Please check your connection and try again."
    );
  } finally {
    if (thisRequest === requestId) {
      setLoading(false);
      elements.loadMore.hidden =
        !hasNextPage || filteredResults.length === 0;
    }
  }
}

function applyCurrentFilters() {
  const genre = elements.genre.value;
  const format = elements.format.value;
  const year = Number(elements.year.value) || 0;
  const status = elements.status.value;

  filteredResults = allResults.filter(anime => {
    return (
      (!genre || anime.genres.includes(genre)) &&
      (!format || anime.format === format) &&
      (!year || anime.year === year) &&
      (!status || anime.status === status)
    );
  });

  // Apply sorting to all currently loaded results.
  switch (elements.sort.value) {
    case "SCORE_DESC":
      filteredResults.sort(
        (a, b) => scoreValue(b.rating) - scoreValue(a.rating)
      );
      break;

    case "TRENDING_DESC":
    case "POPULARITY_DESC":
      filteredResults.sort((a, b) => b.popularity - a.popularity);
      break;

    case "START_DATE_DESC":
      filteredResults.sort((a, b) => b.year - a.year);
      break;

    case "START_DATE":
      filteredResults.sort((a, b) => a.year - b.year);
      break;

    case "TITLE_ROMAJI":
      filteredResults.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  renderResults();
  renderActiveFilters();

  elements.count.textContent = searchTerm
    ? `${filteredResults.length} matching result${filteredResults.length === 1 ? "" : "s"} currently loaded`
    : `${filteredResults.length} anime currently shown`;

  elements.noResults.hidden = filteredResults.length > 0;

  elements.loadMore.hidden =
    !hasNextPage || filteredResults.length === 0 || isLoading;
}

function scoreValue(rating) {
  return rating === "N/A" ? 0 : Number(rating);
}

function formatLabel(format) {
  const labels = {
    TV: "TV Series",
    TV_SHORT: "TV Short",
    MOVIE: "Movie",
    OVA: "OVA",
    ONA: "ONA",
    SPECIAL: "Special",
    MUSIC: "Music"
  };

  return labels[format] || "Anime";
}

function renderResults() {
  elements.grid.innerHTML = "";

  if (!filteredResults.length) {
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredResults.forEach(anime => {
    const card = document.createElement("article");

    card.className = "search-result-card";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `View details for ${anime.title}`);

    const image = escapeHTML(anime.image);
    const title = escapeHTML(anime.title);
    const format = escapeHTML(formatLabel(anime.format));
    const rating = escapeHTML(anime.rating);
    const year = anime.year ? escapeHTML(anime.year) : "Year unknown";
    const episodeText = anime.episodes
      ? ` · ${anime.episodes} eps`
      : "";

    card.innerHTML = `
      <div class="search-poster-wrap">
        ${
          image
            ? `<img class="search-poster" src="${image}" alt="${title} poster" loading="lazy">`
            : `<div class="search-poster-fallback">No poster available</div>`
        }
        <span class="search-poster-badge">${format}</span>
        <span class="search-poster-rating">★ ${rating}</span>
      </div>
      <h3 class="search-result-title">${title}</h3>
      <p class="search-result-meta">${year}${episodeText}</p>
    `;

    const poster = card.querySelector(".search-poster");

    poster?.addEventListener("error", () => {
      poster.style.display = "none";
    });

    const openDetails = () => {
      window.location.href =
        `anime-details.html?id=${encodeURIComponent(anime.id)}`;
    };

    card.addEventListener("click", openDetails);

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });

    fragment.appendChild(card);
  });

  elements.grid.appendChild(fragment);
}

function renderActiveFilters() {
  const filters = [
    { key: "genre", label: elements.genre.selectedOptions[0].textContent, active: Boolean(elements.genre.value) },
    { key: "format", label: elements.format.selectedOptions[0].textContent, active: Boolean(elements.format.value) },
    { key: "year", label: elements.year.selectedOptions[0].textContent, active: Boolean(elements.year.value) },
    { key: "status", label: elements.status.selectedOptions[0].textContent, active: Boolean(elements.status.value) }
  ];

  elements.activeFilters.innerHTML = filters
    .filter(filter => filter.active)
    .map(filter => `
      <span class="filter-chip">
        ${escapeHTML(filter.label)}
        <button type="button" data-remove-filter="${filter.key}" aria-label="Remove ${escapeHTML(filter.label)} filter">×</button>
      </span>
    `)
    .join("");
}

function resetFilters() {
  elements.genre.value = "";
  elements.format.value = "";
  elements.year.value = "";
  elements.status.value = "";

  applyCurrentFilters();
}

function populateYears() {
  const currentYear = new Date().getFullYear();

  for (let year = currentYear + 1; year >= 1960; year--) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    elements.year.appendChild(option);
  }
}

elements.form.addEventListener("submit", event => {
  event.preventDefault();

  searchTerm = elements.input.value.trim();
  updateURL();
  updateHeading();
  runSearch({ reset: true });
});

elements.clearSearch.addEventListener("click", () => {
  elements.input.value = "";
  searchTerm = "";
  updateURL();
  updateHeading();
  runSearch({ reset: true });
  elements.input.focus();
});

elements.sort.addEventListener("change", () => {
  // Refetch from page one so the API's sort order is respected.
  runSearch({ reset: true });
});

elements.applyFilters.addEventListener("click", applyCurrentFilters);
elements.resetFilters.addEventListener("click", resetFilters);
elements.clearAllFilters.addEventListener("click", resetFilters);

elements.loadMore.addEventListener("click", () => {
  if (!isLoading && hasNextPage) {
    runSearch({ reset: false });
  }
});

elements.activeFilters.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-filter]");
  if (!button) return;

  const control = elements[button.dataset.removeFilter];

  if (control) {
    control.value = "";
    applyCurrentFilters();
  }
});

populateYears();

// Read the search query from the URL on first load.
const initialParams = new URLSearchParams(window.location.search);
searchTerm = (initialParams.get("q") || "").trim();

updateHeading();
runSearch({ reset: true });
