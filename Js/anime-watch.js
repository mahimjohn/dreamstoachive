
"use strict";

const ANILIST_API = "https://graphql.anilist.co";
const VIDNEST_BASE = "https://vidnest.fun/anime";

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

const animeId = Number(params.get("id"));
const episodeNumber = Number(params.get("episode"));
const allowedLanguages = ["sub", "dub", "hindi"];

let language = params.get("lang") || "sub";
let anime = null;

const player = $("watchPlayer");
const status = $("watchStatus");
const languageSelect = $("watchLanguage");
const previousButton = $("watchPrevious");
const nextButton = $("watchNext");

function getTitle(media) {
  return media?.title?.english ||
    media?.title?.romaji ||
    media?.title?.native ||
    "Untitled anime";
}

function navigateToEpisode(number, selectedLanguage = language) {
  if (!Number.isInteger(number) || number < 1) return;

  const query = new URLSearchParams({
    id: String(animeId),
    episode: String(number),
    lang: selectedLanguage
  });

  location.href = `anime-watch.html?${query.toString()}`;
}

function updatePlayer() {
  const src = `${VIDNEST_BASE}/${encodeURIComponent(animeId)}/${encodeURIComponent(episodeNumber)}/${encodeURIComponent(language)}`;

  player.src = src;
  player.title = `${getTitle(anime)} - Episode ${episodeNumber}`;

  $("watchEpisodeTitle").textContent =
    `Episode ${episodeNumber}`;

  $("watchEpisodeMeta").textContent =
    `Episode ${episodeNumber} · ${language.toUpperCase()}`;

  status.textContent =
    `Loading Episode ${episodeNumber} (${language.toUpperCase()})...`;

  $("watchAnimeTitle").textContent = getTitle(anime);
  $("watchAnimeTitle").href = `anime-details.html?id=${animeId}`;

  previousButton.disabled = episodeNumber <= 1;

  nextButton.disabled =
    Number.isInteger(anime.episodes) &&
    anime.episodes > 0 &&
    episodeNumber >= anime.episodes;

  $("watchSidebarMessage").textContent =
    `Currently watching Episode ${episodeNumber}. Use Next episode to continue.`;
}

async function loadAnime() {
  if (!Number.isInteger(animeId) || animeId <= 0 ||
      !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    status.textContent = "Invalid anime or episode. Return to the catalogue and select an episode.";
    player.hidden = true;
    previousButton.disabled = true;
    nextButton.disabled = true;
    return;
  }

  if (!allowedLanguages.includes(language)) {
    language = "sub";
  }

  languageSelect.value = language;

  try {
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              episodes
              title {
                english
                romaji
                native
              }
              description(asHtml: false)
            }
          }
        `,
        variables: { id: animeId }
      })
    });

    if (!response.ok) {
      throw new Error(`AniList request failed (${response.status})`);
    }

    const data = await response.json();
    anime = data.data?.Media;

    if (!anime) throw new Error("Anime not found.");

    $("watchDescription").textContent =
      (anime.description || "No synopsis available.")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    updatePlayer();
    document.title =
      `${getTitle(anime)} Episode ${episodeNumber} | Crimson Anime`;
  } catch (error) {
    console.error(error);
    status.textContent =
      "Could not load anime details. You can return to the anime page and try again.";
    $("watchAnimeTitle").textContent = "Anime details unavailable";
  }
}

languageSelect.addEventListener("change", () => {
  if (!allowedLanguages.includes(languageSelect.value)) return;

  language = languageSelect.value;
  if (anime) updatePlayer();
});

previousButton.addEventListener("click", () => {
  navigateToEpisode(episodeNumber - 1);
});

nextButton.addEventListener("click", () => {
  navigateToEpisode(episodeNumber + 1);
});

loadAnime();
