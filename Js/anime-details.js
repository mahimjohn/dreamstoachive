"use strict";

/* =========================================
   CRIMSON ANIME — ANIME DETAILS PAGE
   Anime information: AniList GraphQL
   Episode information: AniList basic list shown instantly, then
   upgraded by Kitsu, Jikan, Jikan episode images and the
   AniList airing schedule (merged per episode number)
========================================= */

const ANILIST_API = "https://graphql.anilist.co";
const KITSU_API = "https://kitsu.io/api/edge";
const JIKAN_API = "https://api.jikan.moe/v4";
const REQUEST_TIMEOUT = 10000;
const EPISODES_PER_LOAD = 30;

const $ = (id) => document.getElementById(id);

const elements = {
    title: $("detailTitle"),
    format: $("detailFormat"),
    meta: $("detailMeta"),
    genres: $("detailGenres"),
    synopsis: $("detailSynopsis"),
    fullSynopsis: $("detailFullSynopsis"),
    banner: $("detailBanner"),
    poster: $("detailPoster"),
    watchlist: $("detailWatchlist"),
    explore: $("episodeJump"),
    toggleSynopsis: $("toggleSynopsis"),
    season: $("seasonSelect"),
    sort: $("episodeSort"),
    grid: $("episodeGrid"),
    summary: $("episodeSummary"),
    notice: $("episodeNotice"),
    episodesSection: $("episodesSection"),
    aniListLink: $("anilistLink"),
    sourceLink: $("detailSourceLink"),
    facts: $("detailFacts"),
    loadMore: $("loadMoreEpisodes"),
    relatedSection: $("relatedSection"),
    relatedList: $("relatedList"),
    toast: $("detailsToast"),
    player: $("vidnestPlayer"),
    playerPlaceholder: $("vidnestPlaceholder"),
    playerStatus: $("vidnestStatus"),
    playerLanguage: $("vidnestLanguage"),
    nowPlaying: $("vidnestNowPlaying"),
    previousEpisode: $("vidnestPrevious"),
    nextEpisode: $("vidnestNext")
};

const params = new URLSearchParams(window.location.search);
const animeId = Number(params.get("id"));

let currentAnime = null;
let allEpisodes = [];
let currentSource = "";
let visibleEpisodeCount = EPISODES_PER_LOAD;
let requestVersion = 0;
let synopsisExpanded = false;
let episodesLoading = false;

let currentPlayingEpisode = null;

const VIDNEST_BASE_URL = "https://vidnest.fun/anime";
const VIDNEST_LANGUAGES = new Set(["sub", "dub", "hindi"]);

/* =========================================
   1. GENERAL HELPERS
========================================= */

function getTitle(anime) {
    return anime?.title?.english ||
        anime?.title?.romaji ||
        anime?.title?.native ||
        "Untitled anime";
}

function normalizeTitle(value) {
    return String(value || "")
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function safeImageUrl(value) {
    if (!value || typeof value !== "string") return "";

    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol)
            ? url.href
            : "";
    } catch {
        return "";
    }
}

function cleanDescription(value) {
    const parser = document.createElement("div");
    parser.innerHTML = String(value || "");

    return (parser.textContent || parser.innerText || "")
        .replace(/\s+/g, " ")
        .trim();
}

function formatDate(value) {
    if (!value) return "Air date unavailable";

    const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})/
    );

    const date = match
        ? new Date(+match[1], +match[2] - 1, +match[3])
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Air date unavailable";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function showToast(message) {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        elements.toast.classList.remove("is-visible");
    }, 2600);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/*
 * Every request has a timeout. This prevents a stalled API
 * request from leaving the page in a permanent loading state.
 *
 * Optional settings (passed inside the options object):
 *   timeoutMs - how long to wait per attempt (default 12000)
 *   retries   - extra attempts after a timeout, network error,
 *               HTTP 429 or HTTP 5xx (default 0)
 */
async function fetchJSON(url, options = {}) {
    const { timeoutMs = 12000, retries = 0, ...fetchOptions } = options;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });

            if (!response.ok) {
                const err = new Error(
                    `Request failed (${response.status}): ${url}`
                );
                err.status = response.status;
                throw err;
            }

            return await response.json();
        } catch (error) {
            let retryable;

            if (error.name === "AbortError") {
                lastError = new Error(`Request timed out: ${url}`);
                retryable = true;
            } else {
                lastError = error;
                retryable =
                    error instanceof TypeError ||
                    error.status === 429 ||
                    error.status >= 500;
            }

            if (!retryable || attempt === retries) throw lastError;

            await sleep(1000 * (attempt + 1));
        } finally {
            clearTimeout(timeout);
        }
    }

    throw lastError;
}

/* =========================================
   2. FETCH ANIME FROM ANILIST
========================================= */

async function fetchAnime(id) {
    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                id
                idMal
                title {
                    romaji
                    english
                    native
                }
                description(asHtml: false)
                episodes
                duration
                format
                status
                season
                seasonYear
                startDate {
                    year
                    month
                    day
                }
                endDate {
                    year
                    month
                    day
                }
                averageScore
                meanScore
                genres
                coverImage {
                    extraLarge
                    large
                    medium
                }
                bannerImage
                streamingEpisodes {
                    title
                    thumbnail
                }
                nextAiringEpisode {
                    episode
                }
                siteUrl
                studios(isMain: true) {
                    nodes {
                        name
                    }
                }
            }
        }
    `;

    const result = await fetchJSON(ANILIST_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query,
            variables: { id }
        })
    });

    if (result.errors?.length) {
        throw new Error(
            result.errors[0].message || "AniList query failed."
        );
    }

    if (!result.data?.Media) {
        throw new Error("Anime not found.");
    }

    return result.data.Media;
}

/* =========================================
   3. RENDER ANIME INFORMATION
========================================= */

function addMetaChip(text) {
    if (!elements.meta) return;

    const chip = document.createElement("span");
    chip.className = "details-meta-chip";
    chip.textContent = text;

    elements.meta.appendChild(chip);
}

function renderFacts(anime) {
    if (!elements.facts) return;

    const facts = [
        ["Status", anime.status?.replaceAll("_", " ") || "Unknown"],
        ["Format", anime.format?.replaceAll("_", " ") || "Unknown"],
        ["Episodes", anime.episodes ?? "Unknown"],
        ["Duration", anime.duration ? `${anime.duration} min` : "Unknown"],
        [
            "Season",
            anime.season
                ? `${anime.season} ${anime.seasonYear || ""}`.trim()
                : "Unknown"
        ],
        [
            "Studio",
            anime.studios?.nodes?.map(s => s.name).join(", ") || "Unknown"
        ]
    ];

    elements.facts.replaceChildren();

    facts.forEach(([label, value]) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");

        dt.textContent = label;
        dd.textContent = String(value);

        row.append(dt, dd);
        elements.facts.appendChild(row);
    });
}

function renderAnime(anime) {
    const title = getTitle(anime);
    const synopsis = cleanDescription(anime.description);

    const banner =
        safeImageUrl(anime.bannerImage) ||
        safeImageUrl(anime.coverImage?.extraLarge) ||
        safeImageUrl(anime.coverImage?.large);

    const poster =
        safeImageUrl(anime.coverImage?.extraLarge) ||
        safeImageUrl(anime.coverImage?.large) ||
        safeImageUrl(anime.coverImage?.medium);

    document.title = `${title} | Crimson Anime`;

    if (elements.title) elements.title.textContent = title;

    if (elements.format) {
        elements.format.textContent =
            (anime.format || "ANIME SERIES").replaceAll("_", " ");
    }

    if (elements.synopsis) {
        elements.synopsis.textContent =
            synopsis || "No synopsis is currently available.";
    }

    if (elements.fullSynopsis) {
        elements.fullSynopsis.textContent =
            synopsis || "No synopsis is currently available.";
    }

    if (elements.banner) {
        elements.banner.style.backgroundImage = banner
            ? `url("${banner}")`
            : "none";
    }

    if (elements.poster) {
        if (poster) {
            elements.poster.src = poster;
            elements.poster.alt = `${title} poster`;
            elements.poster.hidden = false;

            elements.poster.onerror = () => {
                elements.poster.hidden = true;
            };
        } else {
            elements.poster.hidden = true;
        }
    }

    if (elements.meta) {
        elements.meta.replaceChildren();

        addMetaChip(
            (anime.format || "ANIME").replaceAll("_", " ")
        );

        const year = anime.startDate?.year || anime.seasonYear;
        if (year) addMetaChip(String(year));

        if (anime.averageScore != null) {
            addMetaChip(`★ ${(anime.averageScore / 10).toFixed(1)}/10`);
        }

        addMetaChip(
            anime.episodes != null
                ? `${anime.episodes} episodes`
                : "Episode count unknown"
        );

        if (anime.duration) {
            addMetaChip(`${anime.duration} min per episode`);
        }
    }

    if (elements.genres) {
        elements.genres.replaceChildren();

        (anime.genres || []).forEach(genre => {
            const tag = document.createElement("span");
            tag.className = "genre-tag";
            tag.textContent = genre;
            elements.genres.appendChild(tag);
        });
    }

    if (elements.aniListLink) {
        elements.aniListLink.href =
            anime.siteUrl || "https://anilist.co/";
    }

    if (elements.sourceLink) {
        elements.sourceLink.href =
            anime.siteUrl || "https://anilist.co/";
    }

    renderFacts(anime);
    updateWatchlistButton();
    setupSynopsisToggle(synopsis);
}

/* =========================================
   4. SYNOPSIS READ MORE
========================================= */

function setupSynopsisToggle(synopsis) {
    synopsisExpanded = false;

    if (!elements.synopsis || !elements.toggleSynopsis) return;

    elements.synopsis.classList.remove("expanded");

    const needsToggle = synopsis.length > 260;

    elements.toggleSynopsis.hidden = !needsToggle;
    elements.toggleSynopsis.textContent = "Read more ↓";

    if (!needsToggle) return;

    elements.synopsis.textContent = synopsis.slice(0, 260) + "…";

    elements.toggleSynopsis.onclick = () => {
        synopsisExpanded = !synopsisExpanded;

        // The CSS clamps the synopsis to 3 lines unless it is expanded.
        elements.synopsis.classList.toggle("expanded", synopsisExpanded);

        elements.synopsis.textContent = synopsisExpanded
            ? synopsis
            : synopsis.slice(0, 260) + "…";

        elements.toggleSynopsis.textContent = synopsisExpanded
            ? "Read less ↑"
            : "Read more ↓";
    };
}

/* =========================================
   5. WATCHLIST
========================================= */

function readWatchlist() {
    try {
        const list = JSON.parse(
            localStorage.getItem("crimsonAnimeWatchlist") || "[]"
        );

        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function updateWatchlistButton() {
    if (!currentAnime || !elements.watchlist) return;

    const saved = readWatchlist().some(
        item => Number(item.id) === currentAnime.id
    );

    elements.watchlist.textContent = saved
        ? "✓ Added to Watchlist"
        : "♡ Add to Watchlist";

    elements.watchlist.classList.toggle("is-saved", saved);
    elements.watchlist.setAttribute("aria-pressed", String(saved));
}

function toggleWatchlist() {
    if (!currentAnime) return;

    const list = readWatchlist();

    const index = list.findIndex(
        item => Number(item.id) === currentAnime.id
    );

    if (index >= 0) {
        list.splice(index, 1);
        showToast("Removed from your watchlist.");
    } else {
        list.push({
            id: currentAnime.id,
            title: getTitle(currentAnime),
            coverImage:
                currentAnime.coverImage?.large ||
                currentAnime.coverImage?.medium ||
                "",
            siteUrl: currentAnime.siteUrl || ""
        });

        showToast("Added to your watchlist.");
    }

    try {
        localStorage.setItem(
            "crimsonAnimeWatchlist",
            JSON.stringify(list)
        );

        updateWatchlistButton();
    } catch (error) {
        console.error("Could not save watchlist:", error);
        showToast("Could not save the watchlist in this browser.");
    }
}

/* =========================================
   6. KITSU ANIME MATCHING
========================================= */

function getKitsuTitles(item) {
    const attr = item.attributes || {};
    const titles = attr.titles || {};

    return [
        attr.canonicalTitle,
        attr.canonical_title,
        titles.en,
        titles.en_jp,
        titles.ja_jp
    ].filter(Boolean);
}

/*
 * Best match: Kitsu keeps an exact mapping from AniList IDs
 * to its own anime IDs. This avoids failures caused by
 * different title spellings.
 */
async function findKitsuByAniListId(anime) {
    const url = new URL(`${KITSU_API}/mappings`);
    url.searchParams.set("filter[externalSite]", "anilist/anime");
    url.searchParams.set("filter[externalId]", String(anime.id));
    url.searchParams.set("include", "item");

    const result = await fetchJSON(url.href, { retries: 1 });
    const item = result.data?.[0]?.relationships?.item?.data;

    return item && item.type === "anime" ? { id: item.id } : null;
}

async function findKitsuAnime(anime) {
    // 1. Exact match using the AniList ID.
    try {
        const mapped = await findKitsuByAniListId(anime);
        if (mapped) return mapped;
    } catch (error) {
        console.warn("Kitsu ID mapping failed:", error);
    }

    // 2. Fallback: title search.
    const searchTitles = [
        anime.title?.english,
        anime.title?.romaji,
        anime.title?.native
    ].filter(Boolean);

    const wanted = searchTitles.map(normalizeTitle).filter(Boolean);

    for (const searchTitle of searchTitles) {
        const url = new URL(`${KITSU_API}/anime`);
        url.searchParams.set("filter[text]", searchTitle);
        url.searchParams.set("page[limit]", "20");

        const result = await fetchJSON(url.href, { retries: 1 });
        const candidates = result.data || [];

        // Prefer exact title matches to avoid unrelated anime.
        const match = candidates.find(item =>
            getKitsuTitles(item).some(title =>
                wanted.includes(normalizeTitle(title))
            )
        );

        if (match) return match;
    }

    return null;
}

/* =========================================
   7. KITSU EPISODE DATA
========================================= */

function mapKitsuEpisode(item) {
    const attr = item.attributes || {};
    const titles = attr.titles || {};
    const thumb = attr.thumbnail;

    let thumbnail = "";

    if (typeof thumb === "string") {
        thumbnail = safeImageUrl(thumb);
    } else if (thumb && typeof thumb === "object") {
        thumbnail = safeImageUrl(
            thumb.original || thumb.large || thumb.small
        );
    }

    const rawNumber = Number(attr.number);
    const rawSeason = Number(
        attr.seasonNumber ?? attr.season_number
    );

    return {
        number:
            Number.isFinite(rawNumber) && rawNumber > 0
                ? rawNumber
                : null,

        // Empty when unknown: the card shows "Episode N" instead.
        title:
            attr.canonicalTitle ||
            attr.canonical_title ||
            titles.en ||
            titles.en_jp ||
            titles.ja_jp ||
            "",

        airDate: attr.airdate || attr.airDate || null,
        duration: Number(attr.length) || null,
        description: cleanDescription(
            attr.synopsis || attr.description || ""
        ),
        thumbnail,

        season:
            Number.isFinite(rawSeason) && rawSeason > 0
                ? rawSeason
                : null,

        isSpecial: false,
        groupKey: "",
        groupLabel: ""
    };
}

async function fetchKitsuEpisodes(anime, maxPages = 25) {
    const kitsuAnime = await findKitsuAnime(anime);

    if (!kitsuAnime) return [];

    /*
     * Candidate first-page URLs.
     * 1. /anime/{id}/episodes is Kitsu's standard relationship
     *    endpoint (the old /episodes?filter[anime_id] returned 400).
     * 2. /episodes?filter[mediaId] is kept as a backup.
     */
    const candidates = [];

    const relationship = new URL(
        `${KITSU_API}/anime/${kitsuAnime.id}/episodes`
    );
    relationship.searchParams.set("page[limit]", "20");
    relationship.searchParams.set("sort", "number");
    candidates.push(relationship);

    const filtered = new URL(`${KITSU_API}/episodes`);
    filtered.searchParams.set("filter[mediaId]", kitsuAnime.id);
    filtered.searchParams.set("filter[mediaType]", "Anime");
    filtered.searchParams.set("page[limit]", "20");
    filtered.searchParams.set("sort", "number");
    candidates.push(filtered);

    let lastError = null;

    for (const firstURL of candidates) {
        try {
            const episodes = [];
            const visited = new Set();
            let nextURL = firstURL;

            for (let pageNumber = 0; nextURL && pageNumber < maxPages; pageNumber++) {
                const urlString = nextURL.href;

                if (visited.has(urlString)) break;
                visited.add(urlString);

                const result = await fetchJSON(urlString, { retries: 1 });

                episodes.push(
                    ...(result.data || []).map(mapKitsuEpisode)
                );

                if (!result.links?.next) {
                    nextURL = null;
                } else {
                    try {
                        nextURL = new URL(result.links.next);
                    } catch {
                        nextURL = null;
                    }
                }
            }

            // This endpoint worked (even if the list is empty).
            return episodes;
        } catch (error) {
            console.warn("Kitsu episode endpoint failed:", error);
            lastError = error;
        }
    }

    throw lastError;
}

/* =========================================
   8. JIKAN (MYANIMELIST) EPISODE DATA
========================================= */

async function fetchJikanEpisodes(anime) {
    if (!anime.idMal) return [];

    const episodes = [];
    let page = 1;

    while (page <= 5) {
        const url =
            `${JIKAN_API}/anime/${anime.idMal}/episodes?page=${page}`;

        // Jikan can be slow or rate limited: longer timeout + retry.
        const result = await fetchJSON(url, {
            timeoutMs: 15000,
            retries: 1
        });

        (result.data || []).forEach(item => {
            const number = Number(item.mal_id);

            episodes.push({
                number: number > 0 ? number : null,

                title:
                    item.title ||
                    item.title_romanji ||
                    item.title_japanese ||
                    "",

                airDate: item.aired || null,
                duration: null,

                description: [
                    item.filler ? "Filler episode." : "",
                    item.recap ? "Recap episode." : ""
                ].filter(Boolean).join(" "),

                thumbnail: "",
                season: null,
                isSpecial: false,
                groupKey: "",
                groupLabel: ""
            });
        });

        if (!result.pagination?.has_next_page) break;

        page++;
        await sleep(400);
    }

    return episodes;
}

/*
 * Jikan also exposes per-episode preview images for many anime
 * (/anime/{id}/videos/episodes). Only images are taken from it.
 */
async function fetchJikanEpisodeImages(anime) {
    if (!anime.idMal) return [];

    const episodes = [];
    let page = 1;

    while (page <= 5) {
        const url =
            `${JIKAN_API}/anime/${anime.idMal}/videos/episodes?page=${page}`;

        const result = await fetchJSON(url, {
            timeoutMs: 15000,
            retries: 1
        });

        (result.data || []).forEach(item => {
            const match = String(item.episode || item.title || "")
                .match(/(\d+)/);

            const number = match
                ? Number(match[1])
                : Number(item.mal_id);

            const image = safeImageUrl(
                item.images?.jpg?.image_url ||
                item.images?.webp?.image_url ||
                ""
            );

            if (!(number > 0) || !image) return;

            episodes.push({
                number,
                title: "",
                airDate: null,
                duration: null,
                description: "",
                thumbnail: image,
                season: null,
                isSpecial: false,
                groupKey: "",
                groupLabel: ""
            });
        });

        if (!result.pagination?.has_next_page) break;

        page++;
        await sleep(400);
    }

    return episodes;
}

/* =========================================
   8B. ANILIST EPISODE DATA AND FALLBACKS
========================================= */

/* AniList streaming episode metadata (titles + thumbnails). */
function fetchAniListEpisodes(anime) {
    return (anime.streamingEpisodes || []).map((item, index) => {
        const raw = String(item.title || "");
        const match = raw.match(/episode\s*(\d+)/i);
        const number = match ? Number(match[1]) : index + 1;

        const cleanTitle = raw
            .replace(/^episode\s*\d+\s*[-–:]?\s*/i, "")
            .trim();

        return {
            number,
            title: cleanTitle,
            airDate: null,
            duration: null,
            description: "",
            thumbnail: safeImageUrl(item.thumbnail),
            season: null,
            isSpecial: false,
            groupKey: "",
            groupLabel: ""
        };
    });
}

/* AniList airing schedule: used only to fill in air dates. */
async function fetchAniListSchedule(anime) {
    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                airingSchedule(perPage: 50) {
                    nodes {
                        episode
                        airingAt
                    }
                }
            }
        }
    `;

    const result = await fetchJSON(ANILIST_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query,
            variables: { id: anime.id }
        }),
        retries: 1
    });

    const nodes = result.data?.Media?.airingSchedule?.nodes || [];

    return nodes
        .filter(node => node.episode > 0 && node.airingAt)
        .map(node => {
            const date = new Date(node.airingAt * 1000);
            const pad = (n) => String(n).padStart(2, "0");

            // Local calendar date, formatted as YYYY-MM-DD.
            const airDate =
                `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

            return {
                number: node.episode,
                title: "",
                airDate,
                duration: null,
                description: "",
                thumbnail: "",
                season: null,
                isSpecial: false,
                groupKey: "",
                groupLabel: ""
            };
        });
}

/*
 * Last resort: numbered placeholders built from AniList's own
 * episode count, so the section is never blank for a title that
 * clearly has episodes. Unreleased titles get no placeholders.
 */
function buildPlaceholderEpisodes(anime) {
    if (anime.status === "NOT_YET_RELEASED") return [];

    const aired = anime.nextAiringEpisode?.episode
        ? anime.nextAiringEpisode.episode - 1
        : (anime.episodes || 0);

    const count = Math.min(Math.max(aired, 0), 500);

    return Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        title: "",
        airDate: null,
        duration: anime.duration || null,
        description: "",
        thumbnail: "",
        season: null,
        isSpecial: false,
        groupKey: "",
        groupLabel: ""
    }));
}

/* =========================================
   8C. MERGING EPISODE SOURCES
========================================= */

const MERGE_FIELDS = [
    "title",
    "airDate",
    "duration",
    "description",
    "thumbnail",
    "season"
];

function hasValue(value) {
    return value !== null && value !== undefined && value !== "";
}

/*
 * Combines several episode lists into one. Lists are given in
 * priority order. For each episode number, the first list that
 * has a value for a field wins; later lists only fill gaps.
 */
function mergeEpisodeLists(lists) {
    const byNumber = new Map();
    const extras = [];
    const extraKeys = new Set();

    lists.forEach(list => {
        (list || []).forEach(item => {
            const episode = { ...item };
            const number = Number(episode.number);

            // Specials / episodes without a number.
            if (!(number > 0)) {
                const key =
                    normalizeTitle(episode.title) + "|" +
                    (episode.airDate || "");

                if (!extraKeys.has(key)) {
                    extraKeys.add(key);
                    extras.push(episode);
                }

                return;
            }

            episode.number = number;

            const existing = byNumber.get(number);

            if (!existing) {
                byNumber.set(number, episode);
                return;
            }

            MERGE_FIELDS.forEach(field => {
                if (!hasValue(existing[field]) && hasValue(episode[field])) {
                    existing[field] = episode[field];
                }
            });
        });
    });

    return [...byNumber.values(), ...extras];
}


/* =========================================
   VIDNEST PLAYBACK
========================================= */

function loadVidNestEpisode(episode) {
    if (!currentAnime || !episode || !Number.isInteger(episode.number) ||
        episode.number < 1) {
        showToast("This episode has no valid episode number.");
        return;
    }

    const language = elements.playerLanguage?.value || "sub";

    if (!VIDNEST_LANGUAGES.has(language)) {
        showToast("Please select a supported language.");
        return;
    }

    const url = [
        VIDNEST_BASE_URL,
        encodeURIComponent(currentAnime.id),
        encodeURIComponent(episode.number),
        encodeURIComponent(language)
    ].join("/");

    currentPlayingEpisode = episode;

    if (elements.player) {
        elements.player.src = url;
        elements.player.title =
            `${getTitle(currentAnime)} — Episode ${episode.number}`;
    }

    if (elements.playerPlaceholder) {
        elements.playerPlaceholder.hidden = true;
    }

    if (elements.playerStatus) {
        elements.playerStatus.textContent =
            `Loading Episode ${episode.number} (${language.toUpperCase()})...`;
    }

    if (elements.nowPlaying) {
        elements.nowPlaying.textContent =
            `${getTitle(currentAnime)} · Episode ${episode.number}`;
    }

    if (elements.previousEpisode) {
        elements.previousEpisode.disabled =
            !getAdjacentEpisode(-1);
    }

    if (elements.nextEpisode) {
        elements.nextEpisode.disabled =
            !getAdjacentEpisode(1);
    }

    // Highlight the selected episode card.
    document.querySelectorAll(".episode-card").forEach(card => {
        const selected =
            Number(card.dataset.episodeNumber) === episode.number;

        card.classList.toggle("is-playing", selected);
        card.setAttribute("aria-pressed", String(selected));
    });

    // Keep the player visible when an episode is selected.
    document.getElementById("vidnestSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    // Store the selected episode and language in the page URL.
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set("episode", String(episode.number));
    urlParams.set("lang", language);

    history.replaceState(
        null,
        "",
        `${window.location.pathname}?${urlParams.toString()}`
    );
}

function getAdjacentEpisode(direction) {
    if (!currentPlayingEpisode) return null;

    const regularEpisodes = allEpisodes
        .filter(ep => Number.isInteger(ep.number) && ep.number > 0)
        .sort((a, b) => a.number - b.number);

    const index = regularEpisodes.findIndex(
        ep => ep.number === currentPlayingEpisode.number
    );

    if (index < 0) return null;

    return regularEpisodes[index + direction] || null;
}

function playAdjacentEpisode(direction) {
    const episode = getAdjacentEpisode(direction);

    if (episode) {
        loadVidNestEpisode(episode);
    }
}

elements.playerLanguage?.addEventListener("change", () => {
    if (currentPlayingEpisode) {
        loadVidNestEpisode(currentPlayingEpisode);
    }
});

elements.previousEpisode?.addEventListener("click", () => {
    playAdjacentEpisode(-1);
});

elements.nextEpisode?.addEventListener("click", () => {
    playAdjacentEpisode(1);
});


/* =========================================
   9. SEASON / PART GROUPING
========================================= */

/*
 * Use provider season numbers when available.
 * Otherwise group long episode lists into 25-episode parts.
 *
 * These fallback parts are display groups, not official
 * Crunchyroll season names. Actual season information varies
 * between anime and external metadata providers.
 */

function prepareEpisodeGroups(episodes) {
    const normalized = episodes.map(episode => ({
        ...episode,
        number: Number(episode.number) > 0
            ? Number(episode.number)
            : null,
        season: Number(episode.season) > 0
            ? Number(episode.season)
            : null,
        isSpecial: Boolean(episode.isSpecial)
    }));

    const regular = normalized
        .filter(ep => ep.number !== null && !ep.isSpecial)
        .sort((a, b) => a.number - b.number);

    const specials = normalized.filter(
        ep => ep.number === null || ep.isSpecial
    );

    const hasSeasonData = regular.some(
        ep => ep.season !== null
    );

    if (hasSeasonData) {
        regular.forEach(ep => {
            const season = ep.season || 1;
            ep.groupKey = `season-${season}`;
            ep.groupLabel = `Season ${season}`;
        });
    } else {
        const total = regular.length;

        regular.forEach(ep => {
            const part = Math.floor((ep.number - 1) / 25) + 1;
            const first = (part - 1) * 25 + 1;
            const last = Math.min(part * 25, total);

            ep.groupKey = total <= 25
                ? "episodes"
                : `part-${part}`;

            ep.groupLabel = total <= 25
                ? "Episodes"
                : `Season 1 · Part ${part} (E${first}–E${last})`;
        });
    }

    specials.forEach(ep => {
        ep.groupKey = "specials";
        ep.groupLabel = "Specials / OVA";
        ep.isSpecial = true;
    });

    return [...regular, ...specials];
}

function populateSeasonOptions(episodes) {
    if (!elements.season) return;

    const previousValue = elements.season.value;
    elements.season.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = `All episodes (${episodes.length})`;
    elements.season.appendChild(allOption);

    const groups = new Map();

    episodes.forEach(ep => {
        if (!groups.has(ep.groupKey)) {
            groups.set(ep.groupKey, {
                label: ep.groupLabel,
                count: 0,
                firstNumber: Infinity,
                isSpecial: ep.groupKey === "specials"
            });
        }

        const group = groups.get(ep.groupKey);
        group.count++;

        if (ep.number !== null) {
            group.firstNumber = Math.min(
                group.firstNumber,
                ep.number
            );
        }
    });

    const sortedGroups = [...groups.entries()].sort((a, b) => {
        if (a[1].isSpecial && !b[1].isSpecial) return 1;
        if (!a[1].isSpecial && b[1].isSpecial) return -1;

        return a[1].firstNumber - b[1].firstNumber;
    });

    sortedGroups.forEach(([key, group]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = `${group.label} (${group.count})`;
        elements.season.appendChild(option);
    });

    const valueExists = [...elements.season.options].some(
        option => option.value === previousValue
    );

    elements.season.value = valueExists ? previousValue : "all";
    elements.season.disabled = episodes.length === 0;
}

/* =========================================
   10. EPISODE CARDS
========================================= */


function renderEpisodeCard(episode) {
    const card = document.createElement("article");
    card.className = "episode-card";

    const thumbnail = document.createElement("div");
    thumbnail.className = "episode-thumbnail";

    // Use the episode's own artwork when available.
    const ownImage = safeImageUrl(episode.thumbnail);

    // Otherwise, fall back to the anime's artwork.
    const imageURL =
        ownImage ||
        safeImageUrl(currentAnime?.bannerImage) ||
        safeImageUrl(currentAnime?.coverImage?.extraLarge) ||
        safeImageUrl(currentAnime?.coverImage?.large) ||
        safeImageUrl(currentAnime?.coverImage?.medium);

    const fallback = document.createElement("div");
    fallback.className = "thumbnail-fallback";
    fallback.textContent = getTitle(currentAnime);
    fallback.hidden = Boolean(imageURL);

    if (imageURL) {
        const image = document.createElement("img");
        image.src = imageURL;
        image.alt =
            episode.title || `Episode ${episode.number ?? ""}`.trim();
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.remove();
            fallback.hidden = false;
        }, { once: true });

        thumbnail.appendChild(image);
    }

    thumbnail.appendChild(fallback);

    // Dim shared artwork when the episode has no individual thumbnail.
    if (!ownImage) {
        thumbnail.classList.add("is-generic");

        const artLabel = document.createElement("span");
        artLabel.className = "episode-art-label";
        artLabel.textContent = episode.number !== null
            ? `Episode ${episode.number}`
            : "Special";

        thumbnail.appendChild(artLabel);
    }

    // Episode number badge.
    const numberBadge = document.createElement("span");
    numberBadge.className = "episode-number";
    numberBadge.textContent = episode.number !== null
        ? `E${episode.number}`
        : "Special";

    thumbnail.appendChild(numberBadge);

    // Episode duration.
    if (episode.duration) {
        const duration = document.createElement("span");
        duration.className = "episode-duration";
        duration.textContent = `${episode.duration}m`;
        thumbnail.appendChild(duration);
    }

    // Episode information.
    const info = document.createElement("div");
    info.className = "episode-info";

    const title = document.createElement("h3");
    title.className = "episode-title";

    if (episode.number !== null) {
        title.textContent = episode.title
            ? `E${episode.number} – ${episode.title}`
            : `Episode ${episode.number}`;
    } else {
        title.textContent = episode.title || "Special episode";
    }

    const date = document.createElement("p");
    date.className = "episode-date";
    date.textContent = formatDate(episode.airDate);

    info.append(title, date);

    if (episode.description) {
        const description = document.createElement("p");
        description.className = "episode-description";
        description.textContent = episode.description;
        info.appendChild(description);
    }

    // Make regular numbered episodes open the dedicated watch page.
    if (
        Number.isInteger(episode.number) &&
        episode.number > 0 &&
        currentAnime?.id
    ) {
        card.dataset.episodeNumber = String(episode.number);
        card.tabIndex = 0;
        card.setAttribute("role", "link");
        card.setAttribute(
            "aria-label",
            `Watch episode ${episode.number}: ${episode.title || "Untitled"}`
        );

        const openEpisode = () => {
            const query = new URLSearchParams({
                id: String(currentAnime.id),
                episode: String(episode.number),
                lang: "sub"
            });

            window.location.href =
                `anime-watch.html?${query.toString()}`;
        };

        card.addEventListener("click", openEpisode);

        card.addEventListener("keydown", event => {
            if (event.target !== card) return;

            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openEpisode();
            }
        });
    }

    card.append(thumbnail, info);

    return card;
}


/* =========================================
   11. FILTER, SORT AND LOAD MORE
========================================= */

function renderEpisodes() {
    if (!elements.grid) return;

    const selectedGroup = elements.season?.value || "all";
    const sortOrder = elements.sort?.value || "asc";

    const filtered = allEpisodes.filter(episode =>
        selectedGroup === "all" ||
        episode.groupKey === selectedGroup
    );

    filtered.sort((a, b) => {
        if (selectedGroup === "all") {
            if (a.isSpecial && !b.isSpecial) return 1;
            if (!a.isSpecial && b.isSpecial) return -1;
        }

        const numberA = a.number ?? 0;
        const numberB = b.number ?? 0;

        if (numberA !== numberB) {
            return sortOrder === "desc"
                ? numberB - numberA
                : numberA - numberB;
        }

        return String(a.title).localeCompare(String(b.title));
    });

    const shown = filtered.slice(0, visibleEpisodeCount);

    elements.grid.replaceChildren();

    shown.forEach(episode => {
        elements.grid.appendChild(renderEpisodeCard(episode));
    });

    elements.grid.hidden = shown.length === 0;

    if (elements.summary) {
        elements.summary.textContent =
            `${filtered.length} episode${filtered.length === 1 ? "" : "s"} available`;
    }

    if (elements.notice) {
        const loadingNote = episodesLoading
            ? " Looking for more episode details…"
            : "";

        elements.notice.textContent = filtered.length
            ? `Episode metadata loaded from ${currentSource}. Some thumbnails, dates, descriptions or season labels may be unavailable. Crimson Anime does not stream videos.${loadingNote}`
            : "No episodes were found for this selection.";
    }

    if (elements.loadMore) {
        elements.loadMore.hidden =
            shown.length >= filtered.length;
    }
}

function showNoEpisodes(anime) {
    if (elements.notice) {
        elements.notice.textContent =
            anime.status === "NOT_YET_RELEASED"
                ? "This anime has not released any episodes yet."
                : "Episode details are not available for this title right now. The episode databases may not have it yet, or they may be temporarily unavailable. Try refreshing in a minute.";
    }

    if (elements.summary) {
        elements.summary.textContent = "No episode records loaded";
    }

    if (elements.grid) {
        elements.grid.replaceChildren();
        elements.grid.hidden = true;
    }

    if (elements.season) {
        elements.season.disabled = true;
    }

    if (elements.loadMore) {
        elements.loadMore.hidden = true;
    }
}

/* =========================================
   12. LOAD EPISODES (SHOW FAST, THEN UPGRADE)
========================================= */

async function loadEpisodes(anime, version) {
    allEpisodes = [];
    currentSource = "";
    visibleEpisodeCount = EPISODES_PER_LOAD;
    episodesLoading = true;

    if (elements.grid) {
        elements.grid.replaceChildren();
        elements.grid.hidden = true;
    }

    if (elements.season) {
        elements.season.disabled = true;
    }

    if (elements.loadMore) {
        elements.loadMore.hidden = true;
    }

    if (elements.summary) {
        elements.summary.textContent = "Searching episode databases...";
    }

    if (elements.notice) {
        elements.notice.textContent =
            "Searching episode databases...";
    }

    // Results from every source, kept separately so the merge
    // order (priority) never depends on which request finishes first.
    const results = {
        kitsu: [],
        jikan: [],
        jikanImages: [],
        anilist: fetchAniListEpisodes(anime),
        schedule: [],
        placeholders: buildPlaceholderEpisodes(anime)
    };

    const sourceLabels = {
        kitsu: "Kitsu",
        jikan: "Jikan / MyAnimeList",
        jikanImages: "Jikan / MyAnimeList",
        anilist: "AniList",
        schedule: "AniList"
    };

    // Merge everything known so far and redraw the episode list.
    const refresh = () => {
        if (version !== requestVersion) return;

        const merged = mergeEpisodeLists([
            results.kitsu,
            results.jikan,
            results.jikanImages,
            results.anilist,
            results.schedule,
            results.placeholders
        ]);

        if (!merged.length) return;

        const used = [];

        Object.keys(sourceLabels).forEach(key => {
            if (
                results[key].length &&
                !used.includes(sourceLabels[key])
            ) {
                used.push(sourceLabels[key]);
            }
        });

        currentSource = used.length
            ? used.join(" + ")
            : "AniList (episode count only)";

        allEpisodes = prepareEpisodeGroups(merged);

        populateSeasonOptions(allEpisodes);
        renderEpisodes();
    };

    const runSource = async (key, task, label) => {
        try {
            const episodes = await task();

            if (version !== requestVersion) return;

            results[key] = episodes || [];
            refresh();
        } catch (error) {
            // A 404 just means that database does not have this title.
            if (error?.status !== 404) {
                console.warn(`${label} episode lookup failed:`, error);
            }
        }
    };

    // 1. Show whatever AniList already knows, right away.
    refresh();

    // 2. Ask the episode databases in parallel; each one upgrades the list.
    await Promise.allSettled([
        runSource("kitsu", () => fetchKitsuEpisodes(anime), "Kitsu"),
        runSource("jikan", () => fetchJikanEpisodes(anime), "Jikan"),
        runSource(
            "jikanImages",
            () => fetchJikanEpisodeImages(anime),
            "Jikan images"
        )
    ]);

    if (version !== requestVersion) return;

    // 3. Fill missing air dates from the AniList airing schedule.
    if (allEpisodes.some(episode => !episode.airDate)) {
        await runSource(
            "schedule",
            () => fetchAniListSchedule(anime),
            "AniList schedule"
        );
    }

    if (version !== requestVersion) return;

    episodesLoading = false;

    if (!allEpisodes.length) {
        showNoEpisodes(anime);
    } else {
        renderEpisodes();
    }
}

/* =========================================
   13. INITIALIZE DETAILS PAGE
========================================= */

async function initializeDetailsPage() {
    if (!Number.isInteger(animeId) || animeId <= 0) {
        if (elements.title) {
            elements.title.textContent = "Anime not selected";
        }

        if (elements.synopsis) {
            elements.synopsis.textContent =
                "Open this page from an anime card in your catalogue.";
        }

        if (elements.notice) {
            elements.notice.textContent =
                "A valid AniList anime ID is required. Check the URL parameter ?id=...";
        }

        if (elements.summary) {
            elements.summary.textContent = "No anime selected";
        }

        return;
    }

    const version = ++requestVersion;

    try {
        if (elements.title) {
            elements.title.textContent = "Loading anime...";
        }

        if (elements.notice) {
            elements.notice.textContent =
                "Fetching anime information from AniList...";
        }

        const anime = await fetchAnime(animeId);

        if (version !== requestVersion) return;

        currentAnime = anime;
        renderAnime(anime);

        await loadEpisodes(anime, version);
    } catch (error) {
        console.error("Could not load anime details:", error);

        if (elements.title) {
            elements.title.textContent = "Unable to load anime";
        }

        if (elements.synopsis) {
            elements.synopsis.textContent =
                "We couldn't retrieve this anime right now. Check your internet connection and try again.";
        }

        if (elements.notice) {
            elements.notice.textContent =
                `Anime information could not be loaded: ${error.message}`;
        }

        if (elements.summary) {
            elements.summary.textContent = "Loading failed";
        }
    }
}

/* =========================================
   14. EVENT LISTENERS
========================================= */

elements.watchlist?.addEventListener("click", toggleWatchlist);

elements.explore?.addEventListener("click", () => {
    elements.episodesSection?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

elements.season?.addEventListener("change", () => {
    visibleEpisodeCount = EPISODES_PER_LOAD;
    renderEpisodes();
});

elements.sort?.addEventListener("change", () => {
    visibleEpisodeCount = EPISODES_PER_LOAD;
    renderEpisodes();
});

elements.loadMore?.addEventListener("click", () => {
    visibleEpisodeCount += EPISODES_PER_LOAD;
    renderEpisodes();
});

/* =========================================
   15. START
========================================= */

initializeDetailsPage();