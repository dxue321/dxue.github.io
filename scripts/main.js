const state = {
  publications: [],
  activeFilter: "all",
  galleryIndex: 0,
  galleryItems: [],
  galleryTimer: null,
};

const emojiMap = {
  ":sparkles:": "✨",
  ":star:": "⭐",
  ":tada:": "🎉",
  ":rocket:": "🚀",
  ":camera:": "📷",
  ":books:": "📚",
  ":memo:": "📝",
  ":email:": "📧",
  ":link:": "🔗",
  ":heart:": "❤️",
  ":smile:": "😄",
  ":sun:": "☀️",
  ":moon:": "🌙",
};

const textFields = [
  ["name", "[data-site-name]"],
  ["role", "[data-site-role]"],
];

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return response.text();
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return response.json();
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHref(url = "", label = "") {
  if (!url) return "";
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
  if (label.toLowerCase().includes("email") || url.includes("@")) return `mailto:${url}`;
  return `https://${url}`;
}

function versionedAsset(path = "", version = "") {
  if (!path || !version) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(version)}`;
}

function emojify(value = "") {
  return Object.entries(emojiMap).reduce((text, [code, emoji]) => text.replaceAll(code, emoji), value);
}

function inlineMarkdown(value = "") {
  return escapeHtml(emojify(value))
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) return `<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`;
      if (trimmed.startsWith("## ")) return `<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith("# ")) return `<h2>${inlineMarkdown(trimmed.slice(2))}</h2>`;
      if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) return `<figure>${inlineMarkdown(trimmed)}</figure>`;
      if (trimmed.startsWith("- ")) {
        const items = trimmed
          .split("\n")
          .filter((line) => line.startsWith("- "))
          .map((line) => `<li>${inlineMarkdown(line.slice(2).trim())}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inlineMarkdown(trimmed.replace(/\n/g, " "))}</p>`;
    })
    .join("");
}

function parseGallery(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^-\s+/, ""))
    .map((line) => {
      const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (!match) return null;
      return {
        caption: emojify(match[1].trim()),
        src: match[2].trim(),
      };
    })
    .filter(Boolean);
}

function parseNews(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n(?=-\s+\d{4}-\d{2}-\d{2}:)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^-\s+(\d{4}-\d{2}-\d{2}):\s*([\s\S]*)$/);
      if (!match) return null;
      return {
        date: match[1],
        body: markdownToHtml(match[2].trim()),
      };
    })
    .filter(Boolean);
}

function splitBibEntries(bibtex) {
  const entries = [];
  let start = -1;
  let depth = 0;

  for (let index = 0; index < bibtex.length; index += 1) {
    const char = bibtex[index];
    if (char === "@" && depth === 0) start = index;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (start >= 0 && depth === 0 && char === "}") {
      entries.push(bibtex.slice(start, index + 1));
      start = -1;
    }
  }

  return entries;
}

function parseBibEntry(entry) {
  const header = entry.match(/^@(\w+)\s*\{\s*([^,]+),/);
  if (!header) return null;

  const fieldsText = entry.slice(header[0].length, -1);
  const fields = {};
  let index = 0;

  while (index < fieldsText.length) {
    while (/[\s,]/.test(fieldsText[index] || "")) index += 1;

    const nameStart = index;
    while (/\w/.test(fieldsText[index] || "")) index += 1;
    const name = fieldsText.slice(nameStart, index).toLowerCase();
    if (!name) break;

    while (/\s/.test(fieldsText[index] || "")) index += 1;
    if (fieldsText[index] !== "=") break;
    index += 1;
    while (/\s/.test(fieldsText[index] || "")) index += 1;

    const delimiter = fieldsText[index];
    let value = "";

    if (delimiter === "{") {
      let depth = 0;
      index += 1;
      const valueStart = index;
      while (index < fieldsText.length) {
        if (fieldsText[index] === "{") depth += 1;
        if (fieldsText[index] === "}") {
          if (depth === 0) break;
          depth -= 1;
        }
        index += 1;
      }
      value = fieldsText.slice(valueStart, index);
      index += 1;
    } else if (delimiter === '"') {
      index += 1;
      const valueStart = index;
      while (index < fieldsText.length && fieldsText[index] !== '"') index += 1;
      value = fieldsText.slice(valueStart, index);
      index += 1;
    } else {
      const valueStart = index;
      while (index < fieldsText.length && fieldsText[index] !== ",") index += 1;
      value = fieldsText.slice(valueStart, index);
    }

    fields[name] = value.replace(/\s+/g, " ").trim();
  }

  return {
    type: header[1].toLowerCase(),
    key: header[2].trim(),
    ...fields,
  };
}

function parseBibtex(bibtex) {
  return splitBibEntries(bibtex)
    .map(parseBibEntry)
    .filter(Boolean)
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
}

function formatAuthors(authors = "") {
  return authors.replace(/\s+and\s+/g, ", ");
}

function formatAuthorName(author, publication) {
  const normalizedAuthor = author.trim().toLowerCase();
  const isDanna = normalizedAuthor === "xue, danna";
  const isHyperNvdEqualContribution =
    publication.key === "pilligua2025hypernvd" &&
    (normalizedAuthor === "pilligua, maria" || normalizedAuthor === "xue, danna");
  const name = isDanna ? `<strong>${escapeHtml(author.trim())}</strong>` : escapeHtml(author.trim());
  return `${name}${isHyperNvdEqualContribution ? '<sup title="Equal contribution">*</sup>' : ""}`;
}

function formatAuthorsHtml(authors = "", publication) {
  return authors
    .split(/\s+and\s+/)
    .map((author) => formatAuthorName(author, publication))
    .join(", ");
}

function venueWithYear(publication) {
  const venue = publication.journal || publication.booktitle || publication.publisher || publication.note || "";
  if (!venue) return publication.year || "";
  if (!publication.year || venue.includes(publication.year)) return venue;
  return `${venue}, ${publication.year}`;
}

function publicationType(publication) {
  const preprintText = [publication.note, publication.archiveprefix, publication.journal, publication.arxiv]
    .filter(Boolean)
    .join(" ");
  if (publication.type === "misc" && /preprint|arxiv/i.test(preprintText)) {
    return "preprint";
  }
  return publication.type;
}

function publicationLinks(publication) {
  const candidates = [
    ["Paper", publication.paper],
    ["arXiv", publication.arxiv],
    ["Project", publication.project || publication.projectpage],
    ["Code", publication.code],
    ["Data", publication.data || publication.dataset],
    ["Poster", publication.poster],
    ["Slides", publication.slides],
    ["Video", publication.video],
    ["Demo", publication.demo],
    ["Supplement", publication.supplement || publication.supp],
    ["DOI", publication.doi ? `https://doi.org/${publication.doi}` : ""],
    ["Link", publication.url],
  ];
  const seen = new Set();

  return candidates
    .filter(([, href]) => href)
    .filter(([, href]) => {
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    })
    .map(
      ([label, href]) =>
        `<a href="${escapeHtml(normalizeHref(href, label))}" aria-label="${escapeHtml(`${label}: ${publication.title || publication.key}`)}">${escapeHtml(label)}</a>`,
    )
    .join("");
}

function linkIcon(label = "") {
  const normalized = label.toLowerCase();

  if (normalized.includes("github")) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .5C5.73.5.98 5.35.98 11.78c0 5 3.14 9.24 7.5 10.74.55.1.75-.24.75-.54v-2.08c-3.05.68-3.69-1.33-3.69-1.33-.5-1.3-1.22-1.65-1.22-1.65-.99-.69.08-.68.08-.68 1.1.08 1.68 1.16 1.68 1.16.98 1.72 2.58 1.22 3.2.93.1-.73.38-1.22.69-1.5-2.43-.28-4.99-1.25-4.99-5.56 0-1.23.43-2.24 1.13-3.03-.11-.28-.49-1.43.11-2.98 0 0 .93-.31 3.03 1.16A10.26 10.26 0 0 1 12 6.04c.94 0 1.87.13 2.75.38 2.1-1.47 3.02-1.16 3.02-1.16.6 1.55.22 2.7.11 2.98.7.79 1.13 1.8 1.13 3.03 0 4.32-2.56 5.27-5 5.55.39.35.74 1.03.74 2.07v3.09c0 .3.2.65.76.54A11.28 11.28 0 0 0 23 11.78C23 5.35 18.27.5 12 .5Z"/>
      </svg>
    `;
  }

  if (normalized.includes("scholar")) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 1.8 9l10.2 6 8.4-4.94V17h1.8V9L12 3Z"/>
        <path d="M6.2 13.1v3.36c0 1.75 2.6 3.04 5.8 3.04s5.8-1.29 5.8-3.04V13.1L12 16.5l-5.8-3.4Z"/>
      </svg>
    `;
  }

  if (normalized.includes("linkedin")) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.35 8.73H1.9v11.02h3.45V8.73ZM3.62 7.24a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM22.1 13.72c0-3.36-1.8-4.92-4.2-4.92-1.94 0-2.81 1.06-3.29 1.81V8.73h-3.45c.04 1.03 0 11.02 0 11.02h3.45v-6.16c0-.33.02-.66.12-.9.26-.66.86-1.34 1.86-1.34 1.31 0 1.84 1 1.84 2.47v5.93h3.45l.22-6.03Z"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.75 5.75h16.5v12.5H3.75V5.75Zm1.62 1.5L12 12.55l6.63-5.3H5.37Zm13.38 9.5V9.13l-6.29 5.03a.74.74 0 0 1-.92 0L5.25 9.13v7.62h13.5Z"/>
    </svg>
  `;
}

function renderPublications() {
  const container = document.querySelector("[data-publications]");
  if (!container) return;
  const publications =
    state.activeFilter === "all"
      ? state.publications
      : state.publications.filter((publication) => publicationType(publication) === state.activeFilter);

  container.innerHTML = publications
    .map((publication) => {
      const venue = venueWithYear(publication);
      const links = publicationLinks(publication);
      const preview = publication.preview || publication.teaser;
      const teaser = preview
        ? `
          <a class="publication-teaser" href="${escapeHtml(publication.paper || publication.url || publication.arxiv || "#")}" aria-label="${escapeHtml(publication.title || publication.key)}">
            <img src="${escapeHtml(preview)}" alt="" loading="lazy" onerror="this.closest('.publication-teaser').remove()" />
          </a>
        `
        : "";

      return `
        <article class="publication-item ${teaser ? "has-teaser" : ""}" data-type="${escapeHtml(publicationType(publication))}">
          <div class="pub-meta">${escapeHtml(publication.year || "In progress")}</div>
          ${teaser}
          <div>
            <h3 class="publication-title">${inlineMarkdown(publication.title || publication.key)}</h3>
            <div class="publication-authors">${formatAuthorsHtml(publication.author, publication)}</div>
            ${publication.key === "pilligua2025hypernvd" ? '<div class="author-note">*Equal contribution.</div>' : ""}
            <p class="publication-venue">${escapeHtml(venue)}</p>
            ${links ? `<div class="publication-links">${links}</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderNews(markdown) {
  const container = document.querySelector("[data-news]");
  if (!container) return;
  container.innerHTML = parseNews(markdown)
    .map(
      (item) => `
        <article class="news-item">
          <time class="date" datetime="${item.date}">${item.date}</time>
          <div class="news-content">${item.body}</div>
        </article>
      `,
    )
    .join("");
}

function renderGallery(markdown) {
  const container = document.querySelector("[data-gallery]");
  if (!container) return;
  state.galleryItems = parseGallery(markdown);
  state.galleryIndex = 0;

  container.innerHTML = `
    <div class="gallery-viewport">
      <div class="gallery-track">
        ${state.galleryItems
          .map(
            (item) => `
              <figure class="gallery-slide">
                <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption)}" loading="lazy" />
                ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}
              </figure>
            `,
          )
          .join("")}
      </div>
    </div>
    ${
      state.galleryItems.length > 1
        ? `
          <button class="gallery-nav prev" type="button" data-gallery-prev aria-label="Previous gallery image">‹</button>
          <button class="gallery-nav next" type="button" data-gallery-next aria-label="Next gallery image">›</button>
          <div class="gallery-dots" aria-label="Gallery slides">
            ${Array.from({ length: galleryPageCount() })
              .map(
                (_, index) =>
                  `<button class="gallery-dot" type="button" data-gallery-dot="${index}" aria-label="Show gallery page ${index + 1}"></button>`,
              )
              .join("")}
          </div>
        `
        : ""
    }
  `;

  updateGallery();
  container
    .querySelector("[data-gallery-prev]")
    ?.addEventListener("click", () => showGallerySlide(state.galleryIndex - galleryVisibleCount()));
  container
    .querySelector("[data-gallery-next]")
    ?.addEventListener("click", () => showGallerySlide(state.galleryIndex + galleryVisibleCount()));
  container.querySelectorAll("[data-gallery-dot]").forEach((button) => {
    button.addEventListener("click", () => showGalleryPage(Number(button.dataset.galleryDot)));
  });
  startGalleryAutoplay();
}

function updateGallery() {
  const track = document.querySelector(".gallery-track");
  if (!track) return;
  track.style.transform = `translateX(-${(state.galleryIndex * 100) / galleryVisibleCount()}%)`;
  document.querySelectorAll(".gallery-dot").forEach((dot, index) => {
    dot.classList.toggle("is-active", index === Math.floor(state.galleryIndex / galleryVisibleCount()));
  });
}

function galleryVisibleCount() {
  return window.matchMedia("(max-width: 560px)").matches ? 1 : 2;
}

function galleryPageCount() {
  return Math.max(1, Math.ceil(state.galleryItems.length / galleryVisibleCount()));
}

function showGalleryPage(pageIndex) {
  showGallerySlide(pageIndex * galleryVisibleCount());
}

function showGallerySlide(index) {
  if (!state.galleryItems.length) return;
  const visibleCount = galleryVisibleCount();
  const pageCount = galleryPageCount();
  const pageIndex = Math.floor(index / visibleCount);
  const normalizedPage = (pageIndex + pageCount) % pageCount;
  state.galleryIndex = normalizedPage * visibleCount;
  updateGallery();
  startGalleryAutoplay();
}

function startGalleryAutoplay() {
  window.clearInterval(state.galleryTimer);
  if (state.galleryItems.length <= 1) return;
  state.galleryTimer = window.setInterval(() => {
    showGallerySlide(state.galleryIndex + galleryVisibleCount());
  }, 4500);
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = nextTheme;
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.textContent = nextTheme === "dark" ? "Light" : "Dark";
    button.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} mode`);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const preferredTheme =
    savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferredTheme);
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  });
}

function renderSiteConfig(config) {
  document.title = `${config.name} | Academic Homepage`;

  textFields.forEach(([key, selector]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = config[key] || element.textContent;
    });
  });

  const photo = document.querySelector("[data-profile-photo]");
  if (photo && config.photo) photo.src = versionedAsset(config.photo, config.assetVersion);
  if (photo && config.name) photo.alt = `${config.name} portrait`;

  const linksContainer = document.querySelector("[data-site-links]");
  if (linksContainer) {
    linksContainer.innerHTML = (config.links || [])
      .map(
        (link) => `
          <a class="icon-button" href="${escapeHtml(normalizeHref(link.url, link.label))}" aria-label="${escapeHtml(link.label)}" title="${escapeHtml(link.label)}">
            ${linkIcon(link.label)}
          </a>
        `,
      )
      .join("");
  }

  const contactContainer = document.querySelector("[data-contact]");
  if (contactContainer) {
    contactContainer.innerHTML = (config.contact || [])
      .map(
        (item) => `
          <div class="contact-row">
            <span class="contact-label">${escapeHtml(item.label)}</span>
            <span>${item.url ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.value)}</a>` : escapeHtml(item.value)}</span>
          </div>
        `,
      )
      .join("");
  }
}

async function init() {
  initTheme();

  const [config, profile, news, bibtex, gallery] = await Promise.all([
    fetchJson("data/site.json"),
    fetchText("content/profile.md"),
    fetchText("content/news.md"),
    fetchText("content/publications.bib"),
    fetchText("content/gallery.md"),
  ]);

  renderSiteConfig(config);
  const markdownContainer = document.querySelector("[data-markdown]");
  if (markdownContainer) markdownContainer.innerHTML = markdownToHtml(profile);
  renderNews(news);
  state.publications = parseBibtex(bibtex);
  renderPublications();
  renderGallery(gallery);

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      renderPublications();
    });
  });
}

init().catch((error) => {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="load-error">Content failed to load: ${escapeHtml(error.message)}</div>`,
  );
});
