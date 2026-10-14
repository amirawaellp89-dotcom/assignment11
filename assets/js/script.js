/* ==========================================================
   COSMOS - Space Dashboard
   APIs: NASA APOD | SpaceDevs Launches | Solar System OpenData
   ========================================================== */

// ------------------------- Config -------------------------
const NASA_API_KEY = "y4Q1MXabbmw8d6v30ek78OxhQXrBImEeS11MQ3bz"; //  key
const APOD_URL = "https://api.nasa.gov/planetary/apod";
const PLANETS_URL =
  "https://solar-system-opendata-proxy.vercel.app/api/planets";
const LAUNCHES_URL =
  "https://lldev.thespacedevs.com/2.3.0/launches/upcoming/?limit=10";
const LAUNCHES_CACHE_KEY = "cosmos_launches_cache";
const LAUNCHES_CACHE_MS = 10 * 60 * 1000; // lldev بيحدد عدد الريكوستات، فبنخزن النتيجة 10 دقايق

// ------------------------- Helpers ------------------------
const $ = (id) => document.getElementById(id);

const esc = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

const SUPERSCRIPT = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
  "-": "⁻",
};
const toSup = (n) =>
  String(n)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");

const fmtNum = (n, digits = 0) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// yyyy-mm-dd -> Date (من غير مشاكل الـ timezone)
function parseYMD(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const toYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body?.msg || body?.error?.message || body?.detail || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// ==========================================================
// 1) Navigation + Sidebar
// ==========================================================
function initNavigation() {
  const links = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".app-section");
  const sidebar = $("sidebar");
  const toggleBtn = $("sidebar-toggle");

  const ACTIVE = ["bg-blue-500/10", "text-blue-400"];
  const INACTIVE = ["text-slate-300", "hover:bg-slate-800"];

  // overlay للموبايل
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay hidden";
  document.body.appendChild(overlay);

  const openSidebar = () => {
    sidebar.classList.add("sidebar-open");
    overlay.classList.remove("hidden");
  };
  const closeSidebar = () => {
    sidebar.classList.remove("sidebar-open");
    overlay.classList.add("hidden");
  };

  toggleBtn?.addEventListener("click", () =>
    sidebar.classList.contains("sidebar-open") ? closeSidebar() : openSidebar(),
  );
  overlay.addEventListener("click", closeSidebar);

  function showSection(name) {
    sections.forEach((s) =>
      s.classList.toggle("hidden", s.dataset.section !== name),
    );
    links.forEach((l) => {
      const isActive = l.dataset.section === name;
      ACTIVE.forEach((c) => l.classList.toggle(c, isActive));
      INACTIVE.forEach((c) => l.classList.toggle(c, !isActive));
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  links.forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(link.dataset.section);
      closeSidebar();
    }),
  );
}

// ==========================================================
// 2) Today in Space (NASA APOD)
// ==========================================================
function setDateLabel(ymd) {
  const label = document.querySelector(".date-input-wrapper span");
  if (label) {
    label.textContent = parseYMD(ymd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

function renderApodMedia(data) {
  const container = $("apod-image-container");
  const img = $("apod-image");
  const overlay = container.querySelector(".absolute.inset-0");
  container.querySelector("#apod-video")?.remove();

  if (data.media_type === "video") {
    img.classList.add("hidden");
    overlay?.classList.add("hidden");
    const iframe = document.createElement("iframe");
    iframe.id = "apod-video";
    iframe.src = data.url;
    iframe.className = "w-full h-full";
    iframe.allowFullscreen = true;
    iframe.title = data.title;
    container.appendChild(iframe);
  } else {
    img.classList.remove("hidden");
    overlay?.classList.remove("hidden");
    img.src = data.url;
    img.alt = data.title;

    const btn = overlay?.querySelector("button");
    if (btn) {
      btn.onclick = () => window.open(data.hdurl || data.url, "_blank");
    }
  }
}

async function loadApod(date) {
  const loading = $("apod-loading");
  const img = $("apod-image");

  loading.classList.remove("hidden");
  img.classList.add("opacity-0");

  try {
    let url = `${APOD_URL}?api_key=${NASA_API_KEY}`;
    if (date) url += `&date=${date}`;
    const data = await fetchJSON(url);

    const longDate = parseYMD(data.date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    $("apod-date").textContent = `Astronomy Picture of the Day - ${longDate}`;
    $("apod-title").textContent = data.title;
    $("apod-explanation").textContent = data.explanation;
    $("apod-date-detail").innerHTML =
      `<i class="far fa-calendar mr-2"></i>${esc(data.date)}`;
    $("apod-date-info").textContent = data.date;
    $("apod-media-type").textContent =
      data.media_type === "video" ? "Video" : "Image";
    $("apod-copyright").innerHTML = data.copyright
      ? `&copy; ${esc(data.copyright.replace(/\n/g, " ").trim())}`
      : "Public Domain";

    renderApodMedia(data);
    $("apod-date-input").value = data.date;
    setDateLabel(data.date);
  } catch (err) {
    console.error("APOD error:", err);
    $("apod-title").textContent = "Couldn't load the image";
    $("apod-explanation").textContent = err.message;
  } finally {
    loading.classList.add("hidden");
    img.classList.remove("opacity-0");
  }
}

function initApod() {
  const input = $("apod-date-input");
  const today = toYMD(new Date());

  input.max = today;
  input.value = today;
  setDateLabel(today);

  input.addEventListener(
    "change",
    () => input.value && setDateLabel(input.value),
  );
  $("load-date-btn").addEventListener("click", () => {
    if (input.value) loadApod(input.value);
  });
  $("today-apod-btn").addEventListener("click", () => {
    input.value = today;
    loadApod();
  });

  loadApod();
}

// ==========================================================
// 3) Launches (SpaceDevs)
// ==========================================================
const STATUS_COLORS = {
  Go: "#22c55e",
  TBC: "#eab308",
  TBD: "#3b82f6",
  Success: "#22c55e",
  Hold: "#f97316",
  Failure: "#ef4444",
};

function statusBadge(launch, extraClass = "") {
  const abbrev = launch.status?.abbrev || launch.status?.name || "N/A";
  const color = STATUS_COLORS[abbrev] || "#64748b";
  return `<span class="px-3 py-1 rounded-full text-xs font-semibold ${extraClass}"
            style="background:${color}33;color:${color};border:1px solid ${color}66">
            ${esc(abbrev)}</span>`;
}

function launchImage(launch) {
  const img = launch.image;
  return typeof img === "string" ? img : img?.image_url || null;
}

function launchInfo(launch) {
  const net = launch.net ? new Date(launch.net) : null;
  const location = launch.pad?.location;
  return {
    name: launch.name || "Unknown launch",
    provider: launch.launch_service_provider?.name || "Unknown",
    rocket:
      launch.rocket?.configuration?.full_name ||
      launch.rocket?.configuration?.name ||
      "N/A",
    date: net
      ? net.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    longDate: net
      ? net.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    time: net
      ? net.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }) + " UTC"
      : "TBD",
    place: location?.name || launch.pad?.name || "Unknown",
    country:
      location?.country?.name ||
      location?.country_code ||
      location?.country?.alpha_3_code ||
      "N/A",
    description: launch.mission?.description || "No description available yet.",
    daysLeft: net ? Math.max(0, Math.ceil((net - Date.now()) / 86400000)) : "—",
    image: launchImage(launch),
  };
}

function renderFeaturedLaunch(launch) {
  const i = launchInfo(launch);
  const imageBlock = i.image
    ? `<img src="${esc(i.image)}" alt="${esc(i.name)}" class="w-full h-full object-cover absolute inset-0 transition-transform duration-500 group-hover:scale-110" />`
    : `<div class="flex items-center justify-center h-full min-h-[400px] bg-slate-800">
         <i class="fas fa-rocket text-9xl text-slate-700/50"></i></div>`;

  $("featured-launch").innerHTML = `
    <div class="relative bg-slate-800/30 border border-slate-700 rounded-3xl overflow-hidden group hover:border-blue-500/50 transition-all">
      <div class="relative grid grid-cols-1 lg:grid-cols-2 gap-6 p-8">
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 mb-4">
              <span class="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm font-semibold flex items-center gap-2">
                <i class="fas fa-star"></i> Featured Launch
              </span>
              ${statusBadge(launch, "text-sm")}
            </div>
            <h3 class="text-3xl font-bold mb-3 leading-tight">${esc(i.name)}</h3>
            <div class="flex flex-col xl:flex-row xl:items-center gap-4 mb-6 text-slate-400">
              <div class="flex items-center gap-2"><i class="fas fa-building"></i><span>${esc(i.provider)}</span></div>
              <div class="flex items-center gap-2"><i class="fas fa-rocket"></i><span>${esc(i.rocket)}</span></div>
            </div>
            <div class="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-blue-500/20 to-purple-500/20 rounded-xl mb-6">
              <i class="fas fa-clock text-2xl text-blue-400"></i>
              <div>
                <p class="text-2xl font-bold text-blue-400">${i.daysLeft}</p>
                <p class="text-xs text-slate-400">Days Until Launch</p>
              </div>
            </div>
            <div class="grid xl:grid-cols-2 gap-4 mb-6">
              ${infoBox("fa-calendar", "Launch Date", i.longDate)}
              ${infoBox("fa-clock", "Launch Time", i.time)}
              ${infoBox("fa-map-marker-alt", "Location", i.place)}
              ${infoBox("fa-globe", "Country", i.country)}
            </div>
            <p class="text-slate-300 leading-relaxed mb-6">${esc(i.description)}</p>
          </div>
        </div>
        <div class="relative">
          <div class="relative h-full min-h-[400px] rounded-2xl overflow-hidden bg-slate-900/50">
            ${imageBlock}
            <div class="absolute inset-0 bg-linear-to-t from-slate-900 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </div>`;
}

function infoBox(icon, label, value) {
  return `
    <div class="bg-slate-900/50 rounded-xl p-4">
      <p class="text-xs text-slate-400 mb-1 flex items-center gap-2">
        <i class="fas ${icon}"></i> ${label}
      </p>
      <p class="font-semibold text-sm">${esc(value)}</p>
    </div>`;
}

function renderLaunchCard(launch) {
  const i = launchInfo(launch);
  const top = i.image
    ? `<img src="${esc(i.image)}" alt="${esc(i.name)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />`
    : `<i class="fas fa-rocket text-5xl text-slate-700"></i>`;

  return `
    <div class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group cursor-pointer">
      <div class="relative h-48 bg-slate-900/50 flex items-center justify-center overflow-hidden">
        ${top}
        <div class="absolute top-3 right-3">${statusBadge(launch, "backdrop-blur-sm")}</div>
      </div>
      <div class="p-5">
        <div class="mb-3">
          <h4 class="font-bold text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">${esc(i.name)}</h4>
          <p class="text-sm text-slate-400 flex items-center gap-2">
            <i class="fas fa-building text-xs"></i> ${esc(i.provider)}
          </p>
        </div>
        <div class="space-y-2 mb-4">
          <div class="flex items-center gap-2 text-sm"><i class="fas fa-calendar text-slate-500 w-4"></i><span class="text-slate-300">${esc(i.date)}</span></div>
          <div class="flex items-center gap-2 text-sm"><i class="fas fa-clock text-slate-500 w-4"></i><span class="text-slate-300">${esc(i.time)}</span></div>
          <div class="flex items-center gap-2 text-sm"><i class="fas fa-rocket text-slate-500 w-4"></i><span class="text-slate-300 line-clamp-1">${esc(i.rocket)}</span></div>
          <div class="flex items-center gap-2 text-sm"><i class="fas fa-map-marker-alt text-slate-500 w-4"></i><span class="text-slate-300 line-clamp-1">${esc(i.place)}</span></div>
        </div>
      </div>
    </div>`;
}

function updateLaunchCount(n) {
  const desktop = $("launches-count");
  const mobile = $("launches-count-mobile");
  if (desktop) desktop.textContent = `${n} Launches`;
  if (mobile) mobile.textContent = n;
}

async function getLaunches() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(LAUNCHES_CACHE_KEY) || "null",
    );
    if (cached && Date.now() - cached.time < LAUNCHES_CACHE_MS)
      return cached.data;
  } catch (_) {}

  const data = await fetchJSON(LAUNCHES_URL);
  try {
    localStorage.setItem(
      LAUNCHES_CACHE_KEY,
      JSON.stringify({ time: Date.now(), data }),
    );
  } catch (_) {}
  return data;
}

async function loadLaunches() {
  const grid = $("launches-grid");
  const featured = $("featured-launch");

  grid.innerHTML = `<p class="text-slate-400 col-span-full text-center py-12">
    <i class="fas fa-spinner fa-spin mr-2"></i>Loading launches...</p>`;

  try {
    const data = await getLaunches();
    const launches = data.results || [];
    if (!launches.length) throw new Error("No upcoming launches found.");

    updateLaunchCount(launches.length);
    renderFeaturedLaunch(launches[0]);
    grid.innerHTML = launches.slice(1).map(renderLaunchCard).join("");
  } catch (err) {
    console.error("Launches error:", err);
    featured.innerHTML = "";
    grid.innerHTML = `<p class="text-red-400 col-span-full text-center py-12">
      <i class="fas fa-triangle-exclamation mr-2"></i>${esc(err.message)}</p>`;
  }
}

// ==========================================================
// 4) Planets (Solar System OpenData)
// ==========================================================
const PLANET_ORDER = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

const PLANET_DESCRIPTIONS = {
  mercury:
    "Mercury is the smallest planet in our solar system and the closest to the Sun. It has almost no atmosphere, so temperatures swing wildly between scorching days and freezing nights.",
  venus:
    "Venus is the hottest planet thanks to a thick carbon-dioxide atmosphere that traps heat. It spins backwards compared to most planets, so the Sun rises in the west.",
  earth:
    "Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 71% of its surface is covered with water, mostly oceans.",
  mars: "Mars is a cold desert world with the tallest volcano in the solar system, Olympus Mons. Evidence shows it once had liquid water on its surface.",
  jupiter:
    "Jupiter is the largest planet, a gas giant more than twice as massive as all the other planets combined. Its Great Red Spot is a storm bigger than Earth.",
  saturn:
    "Saturn is famous for its spectacular ring system made of ice and rock. It is a gas giant so light that it would float in water.",
  uranus:
    "Uranus is an ice giant that rotates on its side, with an axial tilt of about 98°. Its atmosphere gives it a pale cyan color.",
  neptune:
    "Neptune is the farthest planet from the Sun: a dark, cold, windy ice giant with the fastest winds in the solar system.",
};

let planetsData = {}; // { earth: {...}, mars: {...} }

const val = (v, fallback = "N/A") =>
  v === null || v === undefined || v === "" || Number.isNaN(v) ? fallback : v;

function formatSci(obj, valueKey, expKey, unit) {
  if (!obj || obj[valueKey] == null) return "N/A";
  return `${obj[valueKey]} × 10${toSup(obj[expKey])} ${unit}`.trim();
}

function formatPeriod(days) {
  if (days == null) return "N/A";
  return days > 730
    ? `${fmtNum(days / 365.25, 1)} years`
    : `${fmtNum(days, 1)} days`;
}

function formatRotation(hours) {
  if (hours == null) return "N/A";
  const abs = Math.abs(hours);
  const text =
    abs > 48 ? `${fmtNum(abs / 24, 1)} days` : `${fmtNum(abs, 1)} hours`;
  return hours < 0 ? `${text} (retrograde)` : text;
}

const millionKm = (km) => (km == null ? "N/A" : `${fmtNum(km / 1e6, 1)}M km`);

function buildFacts(p, id) {
  const facts = [];
  if (p.moons?.length)
    facts.push(
      `Has ${p.moons.length} known moon${p.moons.length > 1 ? "s" : ""}`,
    );
  else facts.push("Has no moons");
  if (p.sideralOrbit)
    facts.push(`A year lasts ${formatPeriod(p.sideralOrbit)}`);
  if (p.sideralRotation != null)
    facts.push(`A day lasts ${formatRotation(p.sideralRotation)}`);
  if (p.gravity) facts.push(`Surface gravity is ${fmtNum(p.gravity, 2)} m/s²`);
  if (p.avgTemp)
    facts.push(`Average temperature is ${fmtNum(p.avgTemp - 273.15)}°C`);
  return facts.slice(0, 5);
}

function showPlanet(id) {
  const p = planetsData[id];
  if (!p) return;

  $("planet-detail-image").src = `./assets/images/${id}.png`;
  $("planet-detail-image").alt = `${p.englishName} planet`;
  $("planet-detail-name").textContent = p.englishName;
  $("planet-detail-description").textContent = PLANET_DESCRIPTIONS[id] || "";

  $("planet-distance").textContent = millionKm(p.semimajorAxis);
  $("planet-radius").textContent = p.meanRadius
    ? `${fmtNum(p.meanRadius, 1)} km`
    : "N/A";
  $("planet-mass").textContent = formatSci(
    p.mass,
    "massValue",
    "massExponent",
    "kg",
  );
  $("planet-density").textContent = p.density
    ? `${fmtNum(p.density, 2)} g/cm³`
    : "N/A";
  $("planet-orbital-period").textContent = formatPeriod(p.sideralOrbit);
  $("planet-rotation").textContent = formatRotation(p.sideralRotation);
  $("planet-moons").textContent = p.moons ? p.moons.length : 0;
  $("planet-gravity").textContent = p.gravity
    ? `${fmtNum(p.gravity, 2)} m/s²`
    : "N/A";

  $("planet-discoverer").textContent = val(
    p.discoveredBy,
    "Known since antiquity",
  );
  $("planet-discovery-date").textContent = val(p.discoveryDate, "Ancient");
  $("planet-body-type").textContent = val(p.bodyType, "Planet");
  $("planet-volume").textContent = formatSci(
    p.vol,
    "volValue",
    "volExponent",
    "km³",
  );

  $("planet-perihelion").textContent = millionKm(p.perihelion);
  $("planet-aphelion").textContent = millionKm(p.aphelion);
  $("planet-eccentricity").textContent =
    p.eccentricity != null ? fmtNum(p.eccentricity, 4) : "N/A";
  $("planet-inclination").textContent =
    p.inclination != null ? `${fmtNum(p.inclination, 2)}°` : "N/A";
  $("planet-axial-tilt").textContent =
    p.axialTilt != null ? `${fmtNum(p.axialTilt, 2)}°` : "N/A";
  $("planet-temp").textContent = p.avgTemp
    ? `${fmtNum(p.avgTemp - 273.15)}°C`
    : "N/A";
  $("planet-escape").textContent = p.escape
    ? `${fmtNum(p.escape / 1000, 1)} km/s`
    : "N/A";

  $("planet-facts").innerHTML = buildFacts(p, id)
    .map(
      (f) => `
      <li class="flex items-start">
        <i class="fas fa-check text-green-400 mt-1 mr-2"></i>
        <span class="text-slate-300">${esc(f)}</span>
      </li>`,
    )
    .join("");

  // highlight للكارد المختار
  document.querySelectorAll(".planet-card").forEach((card) => {
    const active = card.dataset.planetId === id;
    card.style.outline = active
      ? `2px solid ${card.style.getPropertyValue("--planet-color")}`
      : "none";
  });
}

async function loadPlanets() {
  try {
    const data = await fetchJSON(PLANETS_URL);
    const bodies = Array.isArray(data)
      ? data
      : data.bodies || data.planets || [];

    bodies.forEach((b) => {
      const key = (b.englishName || b.name || "").toLowerCase();
      if (PLANET_ORDER.includes(key)) {
        planetsData[key] = { ...b, englishName: b.englishName || b.name };
      }
    });

    if (!Object.keys(planetsData).length)
      throw new Error("No planets data found.");

    document.querySelectorAll(".planet-card").forEach((card) =>
      card.addEventListener("click", () => {
        showPlanet(card.dataset.planetId);
        $("planet-detail-name").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }),
    );

    showPlanet(planetsData.earth ? "earth" : Object.keys(planetsData)[0]);
  } catch (err) {
    console.error("Planets error:", err);
    $("planet-detail-description").textContent =
      "Couldn't load planets data: " + err.message;
  }
}

// ==========================================================
// Init
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initApod();
  loadLaunches();
  loadPlanets();
});
