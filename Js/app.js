
/* =========================================================
   CRIMSON ANIME
   AniList-powered anime catalogue
   Plain HTML, CSS and JavaScript
   ========================================================= */

"use strict";

// ---------------------------------------------------------
// 1. CONFIGURATION AND STATE
// ---------------------------------------------------------

const ANILIST_API = "https://graphql.anilist.co";

let animeList = [];
let trendingIds = [];
let recentIds = [];
let featuredIds = [];

let currentSlide = 0;
let currentQuery = "";
let selectedGenre = "";
let activePage = "Home";

let searchResults = null;
let searchRequestId = 0;
let searchDebounceTimer = null;
let searchIsLoading = false;
let toastTimer = null;

const watchlist = new Set();

const toastElement = document.getElementById("toast");
const searchInputs = document.querySelectorAll("#searchInput");
const heroBackground = document.getElementById("heroBackground");
const emptyState = document.getElementById("emptyState");

// ---------------------------------------------------------
// 2. ANILIST QUERY
// ---------------------------------------------------------

const ANIME_QUERY = `
  query (
    $page: Int,
    $perPage: Int,
    $sort: [MediaSort],
    $search: String
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
      }

      media(
        type: ANIME
        isAdult: false
        sort: $sort
        search: $search
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

        bannerImage
        description(asHtml: false)
        averageScore
        popularity
        trending
        episodes
        format
        genres
        seasonYear

        startDate {
          year
          month
          day
        }

        status
        siteUrl
      }
    }
  }
`;

// ---------------------------------------------------------
// 3. API FETCHING AND DATA NORMALIZATION
// ---------------------------------------------------------

async function fetchAnime(sort = ["POPULARITY_DESC"], search = null) {
  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      query: ANIME_QUERY,
      variables: {
        page: 1,
        perPage: 30,
        sort,
        search: search || null
      }
    })
  });

  if (!response.ok) {
    throw new Error(`AniList returned HTTP ${response.status}`);
  }

  const result = await response.json();

  if (result.errors?.length) {
    throw new Error(result.errors.map(error => error.message).join("; "));
  }

  const media = result.data?.Page?.media;

  if (!Array.isArray(media)) {
    throw new Error("AniList returned an invalid response.");
  }

  return media.map(normalizeAnime);
}

function normalizeAnime(item) {
  const year = item.seasonYear || item.startDate?.year || "Unknown";
  const month = item.startDate?.month || 1;
  const day = item.startDate?.day || 1;

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

    genre: item.genres?.[0] || "Anime",
    genres: item.genres || [],

    rating: item.averageScore
      ? (item.averageScore / 10).toFixed(1)
      : "N/A",

    year,

    releaseDate: Number(year) > 0
      ? Number(year) * 10000 + month * 100 + day
      : 0,

    episodes: item.episodes || 0,

    type: item.format === "MOVIE" ? "MOVIE" : "SERIES",

    image:
      item.coverImage?.extraLarge ||
      item.coverImage?.large ||
      "",

    bannerImage: item.bannerImage || "",
    description: cleanDescription(item.description),
    popularity: item.popularity || 0,
    trending: item.trending || 0,
    status: item.status || "UNKNOWN",
    siteUrl: item.siteUrl || "",
    progress: 0
  };
}

function cleanDescription(description) {
  if (!description) {
    return "No description is available yet.";
  }

  return description
    .replace(/<[^>]*>/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------
// 4. LOAD THE HOMEPAGE CATALOGUE
// ---------------------------------------------------------

async function loadAnimeCatalogue() {
  showToast("Loading anime catalogue...");

  try {
    const [trendingAnime, recentAnime] = await Promise.all([
      fetchAnime(["TRENDING_DESC"]),
      fetchAnime(["START_DATE_DESC", "POPULARITY_DESC"])
    ]);

    trendingIds = trendingAnime.map(anime => anime.id);

    recentIds = [...recentAnime]
      .sort((a, b) => b.releaseDate - a.releaseDate)
      .map(anime => anime.id);

    const combined = new Map();

    [...trendingAnime, ...recentAnime].forEach(anime => {
      combined.set(anime.id, anime);
    });

    animeList = [...combined.values()];

    featuredIds = trendingAnime
      .filter(anime => anime.bannerImage || anime.image)
      .slice(0, 5)
      .map(anime => anime.id);

    if (!featuredIds.length) {
      featuredIds = animeList
        .filter(anime => anime.bannerImage || anime.image)
        .slice(0, 5)
        .map(anime => anime.id);
    }

    currentSlide = 0;

    renderRows();
    renderHero();

    showToast(`Loaded ${animeList.length} anime from AniList.`);
  } catch (error) {
    console.error("AniList catalogue error:", error);

    showToast("Unable to load anime. Check your connection and refresh.");

    const trendingRow = document.getElementById("trendingRow");
    const recentRow = document.getElementById("recentRow");

    if (trendingRow) {
      trendingRow.innerHTML =
        '<p class="catalogue-empty">Unable to load trending anime.</p>';
    }

    if (recentRow) {
      recentRow.innerHTML =
        '<p class="catalogue-empty">Unable to load recently added anime.</p>';
    }
  }
}

// ---------------------------------------------------------
// 5. FILTERING HELPERS
// ---------------------------------------------------------

function getFilteredAnime(list = animeList) {
  const query = currentQuery.trim().toLowerCase();

  return list.filter(anime => {
    const matchesSearch =
      !query ||
      anime.titles.some(title => title.toLowerCase().includes(query)) ||
      anime.genres.some(genre => genre.toLowerCase().includes(query)) ||
      anime.description.toLowerCase().includes(query);

    const matchesGenre =
      !selectedGenre || anime.genres.includes(selectedGenre);

    const matchesWatchlist =
      activePage !== "Watchlist" || watchlist.has(anime.id);

    return matchesSearch && matchesGenre && matchesWatchlist;
  });
}

function getAnimeByIds(ids) {
  return ids
    .map(id => animeList.find(anime => anime.id === id))
    .filter(Boolean);
}

function mergeAnimeIntoCatalogue(items) {
  const combined = new Map(animeList.map(anime => [anime.id, anime]));

  items.forEach(anime => combined.set(anime.id, anime));

  animeList = [...combined.values()];
}

// ---------------------------------------------------------
// 6. RENDER HOMEPAGE ROWS
// During search, only the Trending row becomes Search Results.
// The other rows remain unchanged, avoiding large layout shifts.
// ---------------------------------------------------------

function renderRows() {
  const trendingRow = document.getElementById("trendingRow");
  const recentRow = document.getElementById("recentRow");
  const continueRow = document.getElementById("continueRow");

  if (!trendingRow || !recentRow || !continueRow) {
    console.error("One or more anime row containers are missing.");
    return;
  }

  const trendingHeading = document.querySelector(
    "#trending .section-heading h2"
  );

  const trendingKicker = document.querySelector(
    "#trending .section-kicker"
  );

  let trendingAnime;
  let recentAnime;
  let continueAnime;

  if (currentQuery.trim()) {
    if (searchResults !== null) {
      trendingAnime = searchResults.filter(anime =>
        !selectedGenre || anime.genres.includes(selectedGenre)
      );
    } else {
      trendingAnime = [];
    }

    // Do not rebuild the other rows during search.
    recentAnime = null;
    continueAnime = null;
  } else {
    trendingAnime = getFilteredAnime(getAnimeByIds(trendingIds));
    recentAnime = getFilteredAnime(getAnimeByIds(recentIds));
    continueAnime = getFilteredAnime(
      animeList.filter(anime => anime.progress > 0)
    );

    if (activePage === "Watchlist") {
      trendingAnime = getFilteredAnime(
        animeList.filter(anime => watchlist.has(anime.id))
      );

      recentAnime = [];
      continueAnime = [];
    }
  }

  if (trendingHeading) {
    trendingHeading.textContent = currentQuery.trim()
      ? "Search Results"
      : activePage === "Watchlist"
        ? "Your Watchlist"
        : "Trending Anime";
  }

  if (trendingKicker) {
    trendingKicker.textContent = currentQuery.trim()
      ? searchIsLoading
        ? "SEARCHING ANILIST"
        : "MATCHING TITLES"
      : activePage === "Watchlist"
        ? "SAVED FOR LATER"
        : "WHAT'S POPULAR";
  }

  if (currentQuery.trim() && searchIsLoading) {
    trendingRow.innerHTML =
      '<p class="catalogue-empty" role="status">Searching anime...</p>';
  } else {
    renderAnimeCards(trendingRow, trendingAnime || []);
  }

  // Preserve these rows while searching to prevent page-height changes.
  if (recentAnime !== null) {
    renderAnimeCards(recentRow, recentAnime);
  }

  if (continueAnime !== null) {
    if (continueAnime.length) {
      renderAnimeCards(continueRow, continueAnime);
    } else {
      continueRow.innerHTML = `
        <p class="catalogue-empty">
          Your watching history will appear here when
          playback progress tracking is implemented.
        </p>
      `;
    }
  }

  const hasResults = (trendingAnime || []).length > 0;

  if (emptyState) {
    emptyState.hidden =
      !currentQuery.trim() ||
      searchIsLoading ||
      hasResults;
  }

  updateHeroWatchlistButton();
}

// ---------------------------------------------------------
// 7. ANIME CARDS
// ---------------------------------------------------------

function createAnimeCard(anime) {
  const article = document.createElement("article");

  article.className = "anime-card";
  article.dataset.animeId = String(anime.id);
  article.style.cursor = "pointer";
  article.setAttribute("role", "link");
  article.setAttribute("tabindex", "0");
  article.setAttribute("aria-label", `View details for ${anime.title}`);

  const title = escapeHTML(anime.title);
  const image = escapeHTML(anime.image);
  const type = escapeHTML(anime.type);
  const year = escapeHTML(String(anime.year));
  const rating = escapeHTML(String(anime.rating));
  const isSaved = watchlist.has(anime.id);

  article.innerHTML = `
    <div class="poster-wrap">
      <img
        class="anime-poster"
        src="${image}"
        alt="${title} poster"
        loading="lazy"
      >

      <span class="poster-rating">★ ${rating}</span>
      <span class="poster-type">${type}</span>

      <div class="card-overlay">
        <button
          class="quick-add"
          type="button"
          data-action="watchlist"
          data-id="${anime.id}"
          aria-label="${isSaved ? "Remove from" : "Add to"} watchlist"
          title="${isSaved ? "Remove from watchlist" : "Add to watchlist"}"
        >${isSaved ? "✓" : "+"}</button>
      </div>
    </div>

    <h3 class="card-title">${title}</h3>

    <p class="card-meta">
      ${year}${anime.episodes ? ` · ${anime.episodes} episodes` : ""}
    </p>
  `;

  const poster = article.querySelector(".anime-poster");

  poster?.addEventListener("error", () => {
    poster.style.visibility = "hidden";
  });

  article.addEventListener("click", event => {
    if (event.target.closest('[data-action="watchlist"]')) return;
    openAnimeDetails(anime.id);
  });

  article.addEventListener("keydown", event => {
    if (event.target !== article) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAnimeDetails(anime.id);
    }
  });

  return article;
}

function renderAnimeCards(container, animeItems) {
  if (!container) return;

  container.innerHTML = "";

  if (!animeItems.length) {
    const message = document.createElement("p");
    message.className = "catalogue-empty";

    if (activePage === "Watchlist" && !currentQuery) {
      message.textContent =
        "Your watchlist is empty. Add anime using the + button.";
    } else if (currentQuery) {
      message.textContent =
        "No anime found. Try another title or check the spelling.";
    } else if (selectedGenre) {
      message.textContent = "No anime found in this genre.";
    } else {
      message.textContent = "Nothing to show here yet.";
    }

    container.appendChild(message);
    return;
  }

  animeItems.forEach(anime => {
    container.appendChild(createAnimeCard(anime));
  });
}


 // ---------------------------------------------------------
 // 8. NAVIGATE TO THE DEDICATED SEARCH PAGE
 // ---------------------------------------------------------

function openSearchPage(value) {
  const query = String(value || "").trim();

  const url = new URL("search.html", window.location.href);

  if (query) {
    url.searchParams.set("q", query);
  }

  window.location.href = url.href;
}

// Keep compatibility with the existing homepage navigation.
function handleSearch(value) {
  const query = String(value || "").trim();

  if (query) {
    openSearchPage(query);
    return;
  }

  currentQuery = "";
  searchResults = null;
  searchIsLoading = false;
  clearTimeout(searchDebounceTimer);
  searchRequestId++;

  renderRows();
}

const homeSearchForm = document.getElementById("homeSearchForm");

homeSearchForm?.addEventListener("submit", event => {
  event.preventDefault();
  openSearchPage(searchInputs[0]?.value || "");
});

searchInputs.forEach(input => {
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.value = "";
      input.blur();
    }
  });
});

// Keep the document at its current vertical position while editing search.
searchInputs.forEach(input => {
  let savedScrollY = 0;
  let editingSearch = false;

  input.addEventListener("focus", () => {
    savedScrollY = window.scrollY;
    editingSearch = true;
  });

  input.addEventListener("keydown", () => {
    savedScrollY = window.scrollY;

    requestAnimationFrame(() => {
      if (editingSearch && document.activeElement === input) {
        window.scrollTo(0, savedScrollY);
      }
    });
  });

  input.addEventListener("input", () => {
    requestAnimationFrame(() => {
      if (editingSearch && document.activeElement === input) {
        window.scrollTo(0, savedScrollY);
      }
    });
  });

  input.addEventListener("blur", () => {
    editingSearch = false;
  });
});
// ---------------------------------------------------------
// 9. HERO SLIDER
// ---------------------------------------------------------

function renderHero() {
  if (!featuredIds.length) return;

  const anime = animeList.find(item => item.id === featuredIds[currentSlide]);

  if (!anime) return;

  const heroTitle = document.getElementById("heroTitle");
  const heroDescription = document.getElementById("heroDescription");
  const heroRating = document.getElementById("heroRating");
  const heroYear = document.getElementById("heroYear");
  const heroEpisodes = document.getElementById("heroEpisodes");
  const heroGenres = document.getElementById("heroGenres");
  const heroMeta = document.querySelector(".hero-tags .hero-meta");
  const exploreButton = document.getElementById("exploreButton");

  if (heroBackground) {
    const backgroundImage = anime.bannerImage || anime.image;

    heroBackground.style.backgroundImage = backgroundImage
      ? `url("${backgroundImage}")`
      : "none";

    heroBackground.style.backgroundSize = "cover";
    heroBackground.style.backgroundPosition = "center";
  }

  if (heroTitle) heroTitle.textContent = anime.title;
  if (heroDescription) heroDescription.textContent = anime.description;

  if (heroRating) {
    heroRating.textContent =
      anime.rating === "N/A" ? "Not rated" : anime.rating;
  }

  if (heroYear) heroYear.textContent = String(anime.year);

  if (heroEpisodes) {
    heroEpisodes.textContent = anime.episodes
      ? `${anime.episodes} Episodes`
      : anime.type;
  }

  if (heroGenres) {
    heroGenres.innerHTML = anime.genres
      .slice(0, 3)
      .map(genre => `<span class="genre-chip">${escapeHTML(genre)}</span>`)
      .join("");
  }

  if (heroMeta) {
    heroMeta.textContent =
      anime.type === "MOVIE" ? "ANIME MOVIE" : "ANIME SERIES";
  }

  if (exploreButton) {
    exploreButton.onclick = () => openAnimeDetails(anime.id);
  }

  updateHeroWatchlistButton();
  renderHeroDots();
}

function renderHeroDots() {
  const container = document.getElementById("heroPagination");
  if (!container) return;

  container.innerHTML = featuredIds.map((id, index) => `
    <button
      class="hero-dot ${index === currentSlide ? "active" : ""}"
      type="button"
      data-slide="${index}"
      aria-label="Show featured anime ${index + 1}"
      aria-current="${index === currentSlide ? "true" : "false"}"
    ></button>
  `).join("");
}

function nextSlide() {
  if (!featuredIds.length) return;
  currentSlide = (currentSlide + 1) % featuredIds.length;
  renderHero();
}

function previousSlide() {
  if (!featuredIds.length) return;

  currentSlide =
    (currentSlide - 1 + featuredIds.length) % featuredIds.length;

  renderHero();
}

function goToSlide(index) {
  if (index < 0 || index >= featuredIds.length) return;
  currentSlide = index;
  renderHero();
}

// ---------------------------------------------------------
// 10. WATCHLIST
// ---------------------------------------------------------

function updateHeroWatchlistButton() {
  const button = document.getElementById("heroWatchlist");
  if (!button || !featuredIds.length) return;

  const anime = animeList.find(
    item => item.id === featuredIds[currentSlide]
  );

  if (!anime) return;

  const saved = watchlist.has(anime.id);

  button.innerHTML = saved
    ? '♥ <span>Added to Watchlist</span>'
    : '♡ <span>Add to Watchlist</span>';

  button.onclick = () => toggleWatchlist(anime.id);
}

function toggleWatchlist(animeId) {
  const id = Number(animeId);
  const anime = animeList.find(item => item.id === id);

  if (!anime) {
    showToast("Anime details are not available yet.");
    return;
  }

  if (watchlist.has(id)) {
    watchlist.delete(id);
    showToast(`Removed ${anime.title} from your watchlist.`);
  } else {
    watchlist.add(id);
    showToast(`Added ${anime.title} to your watchlist.`);
  }

  renderRows();
}

// ---------------------------------------------------------
// 11. GENRES AND NAVIGATION
// ---------------------------------------------------------

function setGenre(genre) {
  selectedGenre = genre || "";

  document.querySelectorAll("[data-genre]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.genre === selectedGenre
    );
  });

  renderRows();
}

function setActivePage(page) {
  activePage = page;

  document.querySelectorAll(".top-link").forEach(link => {
    link.classList.toggle("active", link.textContent.trim() === page);
  });

  renderRows();
}

document.querySelectorAll(".top-link").forEach(link => {
  link.addEventListener("click", event => {
    const label = link.textContent.trim();

    if (label === "Watchlist") {
      event.preventDefault();
      setActivePage("Watchlist");

      document.getElementById("trending")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      return;
    }

    if (label === "Home") setActivePage("Home");
    if (label === "Discover") setActivePage("Discover");
    if (label === "Trending") setActivePage("Trending");
    if (label === "Genres") setActivePage("Genres");

    const href = link.getAttribute("href");

    if (href?.startsWith("#")) {
      const section = document.querySelector(href);

      if (section) {
        event.preventDefault();
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
});

const brandLink = document.querySelector(".brand");

brandLink?.addEventListener("click", () => {
  activePage = "Home";
  selectedGenre = "";

  searchInputs.forEach(input => {
    input.value = "";
  });

  handleSearch("");
});

// ---------------------------------------------------------
// 12. ANIME DETAILS PAGE
// ---------------------------------------------------------

function openAnimeDetails(animeId) {
  const id = Number(animeId);

  window.location.href =
    `anime-details.html?id=${encodeURIComponent(id)}`;
}

function closeAnimeDetails() {
  const detailsModal = document.getElementById("detailsModal");

  if (detailsModal) {
    detailsModal.hidden = true;
    detailsModal.setAttribute("aria-hidden", "true");
  }
}

// ---------------------------------------------------------
// 13. CAROUSEL ARROWS
// ---------------------------------------------------------

document.querySelectorAll(".arrow-btn[data-target]").forEach(button => {
  button.addEventListener("click", () => {
    const row = document.getElementById(button.dataset.target);
    if (!row) return;

    const direction = Number(button.dataset.direction) || 1;

    row.scrollBy({
      left: direction * Math.max(row.clientWidth * 0.8, 250),
      behavior: "smooth"
    });
  });
});

// ---------------------------------------------------------
// 14. TOAST MESSAGES
// ---------------------------------------------------------

function showToast(message) {
  if (!toastElement) {
    console.log(message);
    return;
  }

  toastElement.textContent = message;
  toastElement.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastElement.classList.remove("show");
  }, 2800);
}

// ---------------------------------------------------------
// 15. SAFE HTML
// ---------------------------------------------------------

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

// ---------------------------------------------------------
// 16. GLOBAL CLICK AND KEYBOARD EVENTS
// ---------------------------------------------------------

document.addEventListener("click", event => {
  const target = event.target.closest(
    "[data-action], [data-slide], [data-genre], [data-close-modal]"
  );

  if (!target) return;

  if (target.dataset.action === "watchlist") {
    toggleWatchlist(target.dataset.id);
    return;
  }

  if (target.dataset.action === "details") {
    openAnimeDetails(target.dataset.id);
    return;
  }

  if (target.hasAttribute("data-slide")) {
    goToSlide(Number(target.dataset.slide));
    return;
  }

  if (target.hasAttribute("data-genre")) {
    setGenre(target.dataset.genre);
    return;
  }

  if (target.hasAttribute("data-close-modal")) {
    closeAnimeDetails();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeAnimeDetails();
  }

  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
  ) {
    event.preventDefault();
    searchInputs[0]?.focus();
  }
});

// ---------------------------------------------------------
// 17. START
// ---------------------------------------------------------

loadAnimeCatalogue();
