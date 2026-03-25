const DATA_BASE_REMOTE = "https://ddm999.github.io/gt7info/data/db";
const DATA_META_REMOTE = "https://ddm999.github.io/gt7info/data.json";
const DATA_BASE_LOCAL = "./data";

const weathers = ["Clear", "Overcast", "Rain", "Variable", "Sunset", "Night", "Random"];
const tires = [
  "Comfort Soft",
  "Comfort Medium",
  "Comfort Hard",
  "Sports Soft",
  "Sports Medium",
  "Sports Hard",
  "Racing Soft",
  "Racing Medium",
  "Racing Hard",
  "Intermediate",
  "Wet"
];

const tireCodeMap = {
  "Comfort Hard": "CH",
  "Comfort Medium": "CM",
  "Comfort Soft": "CS",
  "Sports Hard": "SH",
  "Sports Medium": "SM",
  "Sports Soft": "SS",
  "Racing Hard": "RH",
  "Racing Medium": "RM",
  "Racing Soft": "RS",
  Intermediate: "IM",
  Wet: "W"
};

const elements = {
  carCountry: document.getElementById("carCountry"),
  carBrand: document.getElementById("carBrand"),
  carName: document.getElementById("carName"),
  carFilter: document.getElementById("carFilter"),
  trackCountry: document.getElementById("trackCountry"),
  trackName: document.getElementById("trackName"),
  trackLayout: document.getElementById("trackLayout"),
  trackFilter: document.getElementById("trackFilter"),
  weather: document.getElementById("weather"),
  tires: document.getElementById("tires"),
  result: document.getElementById("result"),
  generate: document.getElementById("generate"),
  randomize: document.getElementById("randomize"),
  addCar: document.getElementById("addCar"),
  addTrack: document.getElementById("addTrack"),
  newCarCountry: document.getElementById("newCarCountry"),
  newCarBrand: document.getElementById("newCarBrand"),
  newCarName: document.getElementById("newCarName"),
  newTrackCountry: document.getElementById("newTrackCountry"),
  newTrackName: document.getElementById("newTrackName"),
  newTrackLayouts: document.getElementById("newTrackLayouts"),
  dataStatus: document.getElementById("dataStatus"),
  dataUpdated: document.getElementById("dataUpdated"),
  setupImport: document.getElementById("setupImport"),
  setupImportBtn: document.getElementById("setupImportBtn"),
  setupClearBtn: document.getElementById("setupClearBtn"),
  setupExportBtn: document.getElementById("setupExportBtn"),
  setupCount: document.getElementById("setupCount"),
  setupMatchCount: document.getElementById("setupMatchCount"),
  setupMatches: document.getElementById("setupMatches"),
  setupFilterCar: document.getElementById("setupFilterCar"),
  setupFilterTrack: document.getElementById("setupFilterTrack"),
  setupFilterLayout: document.getElementById("setupFilterLayout"),
  setupFilterWeather: document.getElementById("setupFilterWeather"),
  setupFilterTires: document.getElementById("setupFilterTires"),
  setupFilterSearch: document.getElementById("setupFilterSearch"),
  setupFilterApply: document.getElementById("setupFilterApply"),
  setupFilterReset: document.getElementById("setupFilterReset"),
  presetSave: document.getElementById("presetSave"),
  presetNote: document.getElementById("presetNote"),
  presetSuspension: document.getElementById("presetSuspension"),
  presetTransmission: document.getElementById("presetTransmission"),
  presetAero: document.getElementById("presetAero"),
  presetLsd: document.getElementById("presetLsd")
};

let cars = [];
let tracks = [];
let stockPerfByCar = new Map();
let engineSwapsByCar = new Map();
let setupDb = [];

const setupStorageKey = "gt7-setup-db";
const setupFilterState = {
  car: "",
  track: "",
  layout: "",
  weather: "",
  tires: "",
  search: ""
};
const setupFilterState = {
  car: "",
  track: "",
  layout: "",
  weather: "",
  tires: "",
  search: ""
};
const setupFilterState = {
  car: "",
  track: "",
  layout: "",
  weather: "",
  tires: "",
  search: ""
};

function setLoadingState(isLoading) {
  const selects = [
    elements.carCountry,
    elements.carBrand,
    elements.carName,
    elements.trackCountry,
    elements.trackName,
    elements.trackLayout
  ];
  selects.forEach((select) => {
    select.disabled = isLoading;
    if (isLoading) {
      select.innerHTML = "<option>Loading...</option>";
    }
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      }
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.text();
}

async function loadCsv(name) {
  const remoteUrl = `${DATA_BASE_REMOTE}/${name}`;
  const localUrl = `${DATA_BASE_LOCAL}/${name}`;
  try {
    return await fetchText(remoteUrl);
  } catch (error) {
    return await fetchText(localUrl);
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveLayoutName(courseName, baseName) {
  if (!courseName) return "Layout";
  if (courseName === baseName) return "GP";

  if (baseName && courseName.startsWith(baseName)) {
    const remaining = courseName.slice(baseName.length).trim();
    if (remaining.startsWith("-")) return remaining.slice(1).trim();
    if (remaining.startsWith(":")) return remaining.slice(1).trim();
    if (remaining) return remaining;
  }

  if (courseName.includes(" - ")) {
    return courseName.split(" - ").slice(1).join(" - ");
  }

  if (courseName.includes(": ")) {
    return courseName.split(": ").slice(1).join(": ");
  }

  return courseName;
}

function buildOptions(select, values) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]))];
}

function sortCars(list) {
  return [...list].sort((a, b) => {
    return (
      a.country.localeCompare(b.country) ||
      a.brand.localeCompare(b.brand) ||
      a.name.localeCompare(b.name)
    );
  });
}

function sortTracks(list) {
  return [...list].sort((a, b) => {
    return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
  });
}

function filteredCars() {
  const filter = elements.carFilter.value.trim().toLowerCase();
  if (!filter) return sortCars(cars);
  return sortCars(cars.filter((car) => car.name.toLowerCase().includes(filter)));
}

function filteredTracks() {
  const filter = elements.trackFilter.value.trim().toLowerCase();
  if (!filter) return sortTracks(tracks);
  return sortTracks(
    tracks.filter(
      (track) =>
        track.name.toLowerCase().includes(filter) ||
        track.layouts.some((layout) => layout.name.toLowerCase().includes(filter))
    )
  );
}

function renderCarSelectors() {
  const list = filteredCars();
  const countries = uniqueValues(list, "country");
  buildOptions(elements.carCountry, countries);
  if (!countries.length) return;

  const selectedCountry = elements.carCountry.value || countries[0];
  elements.carCountry.value = selectedCountry;

  const brands = uniqueValues(list.filter((c) => c.country === selectedCountry), "brand");
  buildOptions(elements.carBrand, brands);
  const selectedBrand = elements.carBrand.value || brands[0];
  elements.carBrand.value = selectedBrand;

  const carNames = list
    .filter((c) => c.country === selectedCountry && c.brand === selectedBrand)
    .map((c) => c.name);
  buildOptions(elements.carName, carNames);
}

function renderTrackSelectors() {
  const list = filteredTracks();
  const countries = uniqueValues(list, "country");
  buildOptions(elements.trackCountry, countries);
  if (!countries.length) return;

  const selectedCountry = elements.trackCountry.value || countries[0];
  elements.trackCountry.value = selectedCountry;

  const trackNames = list
    .filter((t) => t.country === selectedCountry)
    .map((t) => t.name);
  buildOptions(elements.trackName, trackNames);
  const selectedTrack = elements.trackName.value || trackNames[0];
  elements.trackName.value = selectedTrack;

  const layouts = list.find((t) => t.name === selectedTrack)?.layouts ?? [];
  buildOptions(elements.trackLayout, layouts.map((layout) => layout.name));
}

function renderConditions() {
  buildOptions(elements.weather, weathers);
  buildOptions(elements.tires, tires);
}

function findSelectedCar() {
  return cars.find(
    (car) =>
      car.country === elements.carCountry.value &&
      car.brand === elements.carBrand.value &&
      car.name === elements.carName.value
  );
}

function findSelectedTrackLayout() {
  const track = tracks.find((t) => t.name === elements.trackName.value);
  if (!track) return null;
  return track.layouts.find((layout) => layout.name === elements.trackLayout.value) || null;
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined) return "-";
  return `${value}${suffix}`;
}

function loadSetupDb() {
  const stored = localStorage.getItem(setupStorageKey);
  setupDb = stored ? JSON.parse(stored) : [];
  updateSetupCount();
  updateSetupFilterOptions();
}

function saveSetupDb() {
  localStorage.setItem(setupStorageKey, JSON.stringify(setupDb));
  updateSetupCount();
  updateSetupFilterOptions();
  renderSetupMatches();
}




function updateSetupCount() {
  elements.setupCount.textContent = `${setupDb.length} Einträge`;
}

function getCurrentSelectionFilter() {
  return {
    car: elements.carName.value || "",
    track: elements.trackName.value || "",
    layout: elements.trackLayout.value || "",
    weather: elements.weather.value || "",
    tires: elements.tires.value || ""
  };
}

function buildOptionsWithAll(select, values, selectedValue) {
  const list = [...values];
  if (selectedValue && !list.includes(selectedValue)) {
    list.unshift(selectedValue);
  }
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Alle";
  select.appendChild(allOption);
  list.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = selectedValue || "";
}

function updateSetupFilterOptions() {
  const carValues = cars.map((car) => car.name).filter(Boolean).sort();
  const trackValues = tracks.map((track) => track.name).filter(Boolean).sort();
  const weatherValues = [...weathers];
  const tireValues = [...tires];

  let layoutValues = [];
  if (setupFilterState.track) {
    const selectedTrack = tracks.find((track) => track.name === setupFilterState.track);
    layoutValues = selectedTrack ? selectedTrack.layouts.map((layout) => layout.name) : [];
  } else {
    layoutValues = tracks.flatMap((track) => track.layouts.map((layout) => layout.name));
  }
  layoutValues = [...new Set(layoutValues.filter(Boolean))].sort();

  if (setupFilterState.layout && !layoutValues.includes(setupFilterState.layout)) {
    setupFilterState.layout = "";
  }

  buildOptionsWithAll(elements.setupFilterCar, carValues, setupFilterState.car);
  buildOptionsWithAll(elements.setupFilterTrack, trackValues, setupFilterState.track);
  buildOptionsWithAll(elements.setupFilterLayout, layoutValues, setupFilterState.layout);
  buildOptionsWithAll(elements.setupFilterWeather, weatherValues, setupFilterState.weather);
  buildOptionsWithAll(elements.setupFilterTires, tireValues, setupFilterState.tires);
}

function applySelectionToFilters() {
  const selection = getCurrentSelectionFilter();
  setupFilterState.car = selection.car;
  setupFilterState.track = selection.track;
  setupFilterState.layout = selection.layout;
  setupFilterState.weather = selection.weather;
  setupFilterState.tires = selection.tires;
  setupFilterState.search = "";
  elements.setupFilterSearch.value = "";
  updateSetupFilterOptions();
  renderSetupMatches();
}

function applyFiltersFromUI() {
  setupFilterState.car = elements.setupFilterCar.value;
  setupFilterState.track = elements.setupFilterTrack.value;
  setupFilterState.layout = elements.setupFilterLayout.value;
  setupFilterState.weather = elements.setupFilterWeather.value;
  setupFilterState.tires = elements.setupFilterTires.value;
  setupFilterState.search = elements.setupFilterSearch.value.trim();
  updateSetupFilterOptions();
  renderSetupMatches();
}

function entryMatchesSearch(entry, search) {
  if (!search) return true;
  const haystack = [
    entry.car,
    entry.track,
    entry.layout,
    entry.setup?.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function scoreSetupMatch(entry, filters) {
  let score = 0;
  if (filters.car && entry.car === filters.car) score += 3;
  if (filters.track && entry.track === filters.track) score += 3;
  if (filters.layout && entry.layout === filters.layout) score += 2;
  if (filters.weather && entry.weather === filters.weather) score += 1;
  if (filters.tires && entry.tires === filters.tires) score += 1;
  if (filters.search && entryMatchesSearch(entry, filters.search)) score += 1;
  return score;
}

function renderSetupMatches() {
  const filters = { ...setupFilterState };
  const activeFieldFilters = ["car", "track", "layout", "weather", "tires"].filter(
    (key) => filters[key]
  );
  const hasSearch = Boolean(filters.search);

  const matches = setupDb
    .map((entry) => {
      const fieldMatches = activeFieldFilters.map((key) => entry[key] === filters[key]);
      const fieldMatchCount = fieldMatches.filter(Boolean).length;
      const searchOk = entryMatchesSearch(entry, filters.search);
      const exact =
        (activeFieldFilters.length > 0 ? fieldMatchCount === activeFieldFilters.length : true) &&
        (!hasSearch || searchOk);

      const include =
        (activeFieldFilters.length === 0 && !hasSearch) ||
        (hasSearch && searchOk) ||
        fieldMatchCount > 0;

      if (!include) return null;

      return {
        entry,
        score: scoreSetupMatch(entry, filters),
        exact
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      const nameCompare = (a.entry.car || "").localeCompare(b.entry.car || "");
      if (nameCompare !== 0) return nameCompare;
      return (a.entry.track || "").localeCompare(b.entry.track || "");
    });

  elements.setupMatchCount.textContent = `${matches.length} Treffer`;

  if (!matches.length) {
    elements.setupMatches.innerHTML = "<div class=\"muted\">Keine passenden Setups gefunden.</div>";
    return;
  }

  elements.setupMatches.innerHTML = matches
    .map(({ entry, score, exact }) => {
      const parts = [
        `<div><strong>${entry.car}</strong> — ${entry.track}${entry.layout ? ` / ${entry.layout}` : ""}</div>`,
        `<div class="setup-card__meta"><span>Score: ${score}</span>${exact ? "<span class=\"badge\">Exact Match</span>" : ""}</div>`,
        entry.weather ? `<div>Wetter: ${entry.weather}</div>` : "",
        entry.tires ? `<div>Reifen: ${entry.tires}</div>` : "",
        entry.setup?.suspension ? `<div>Fahrwerk: ${entry.setup.suspension}</div>` : "",
        entry.setup?.transmission ? `<div>Getriebe: ${entry.setup.transmission}</div>` : "",
        entry.setup?.aero ? `<div>Aero: ${entry.setup.aero}</div>` : "",
        entry.setup?.lsd ? `<div>LSD: ${entry.setup.lsd}</div>` : "",
        entry.setup?.notes ? `<div>Notiz: ${entry.setup.notes}</div>` : ""
      ].filter(Boolean);

      return `<div class="setup-card">${parts.join("")}</div>`;
    })
    .join("");
}


function generateSetup() {
  const car = findSelectedCar();
  const layout = findSelectedTrackLayout();
  const tireName = elements.tires.value;
  const tireCode = tireCodeMap[tireName];
  const stockPerf = car ? stockPerfByCar.get(car.id) : null;
  const pp = stockPerf && tireCode ? stockPerf[tireCode] : null;
  const engineSwaps = car ? engineSwapsByCar.get(car.id) : null;

  elements.result.innerHTML = `
    <div><strong>Auto:</strong> ${elements.carCountry.value} / ${elements.carBrand.value} / ${elements.carName.value}</div>
    <div><strong>Strecke:</strong> ${elements.trackCountry.value} / ${elements.trackName.value} / ${elements.trackLayout.value}</div>
    <div><strong>Wetter:</strong> ${elements.weather.value}</div>
    <div><strong>Reifen:</strong> ${tireName}</div>
    <div><strong>PP (Serie):</strong> ${pp ? pp.toFixed(2) : "-"}</div>
    <div><strong>L?nge:</strong> ${layout ? formatNumber(layout.length, " m") : "-"}</div>
    <div><strong>Kurven:</strong> ${layout ? formatNumber(layout.corners) : "-"}</div>
    <div><strong>H?henmeter:</strong> ${layout ? formatNumber(layout.elevation, " m") : "-"}</div>
    <div><strong>Regen erlaubt:</strong> ${layout ? (layout.noRain ? "Nein" : "Ja") : "-"}</div>
    <div><strong>Engine Swap:</strong> ${engineSwaps && engineSwaps.length ? engineSwaps.join(", ") : "-"}</div>
  `;

  renderSetupMatches();
}

function randomChoice(list) {
(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomize() {
  const carList = sortCars(cars);
  const trackList = sortTracks(tracks);

  const car = randomChoice(carList);
  elements.carCountry.value = car.country;
  renderCarSelectors();
  elements.carBrand.value = car.brand;
  renderCarSelectors();
  elements.carName.value = car.name;

  const track = randomChoice(trackList);
  elements.trackCountry.value = track.country;
  renderTrackSelectors();
  elements.trackName.value = track.name;
  renderTrackSelectors();
  elements.trackLayout.value = randomChoice(track.layouts).name;

  elements.weather.value = randomChoice(weathers);
  elements.tires.value = randomChoice(tires);

  generateSetup();
}

function addCar() {
  const country = elements.newCarCountry.value.trim();
  const brand = elements.newCarBrand.value.trim();
  const name = elements.newCarName.value.trim();
  if (!country || !brand || !name) return;
  cars.push({ id: `custom-${Date.now()}`, country, brand, name });
  elements.newCarCountry.value = "";
  elements.newCarBrand.value = "";
  elements.newCarName.value = "";
  renderCarSelectors();
}

function addTrack() {
  const country = elements.newTrackCountry.value.trim();
  const name = elements.newTrackName.value.trim();
  const layouts = elements.newTrackLayouts.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((layoutName) => ({ name: layoutName }));
  if (!country || !name || !layouts.length) return;
  tracks.push({ country, name, layouts });
  elements.newTrackCountry.value = "";
  elements.newTrackName.value = "";
  elements.newTrackLayouts.value = "";
  renderTrackSelectors();
}

function normalizeSetupEntry(entry) {
  return {
    car: entry.car || entry.Car || entry.auto || "",
    track: entry.track || entry.Track || entry.strecke || "",
    layout: entry.layout || entry.Layout || entry.layoutname || "",
    weather: entry.weather || entry.Wetter || "",
    tires: entry.tires || entry.Reifen || entry.tyres || "",
    setup: {
      suspension: entry.suspension || entry.setup_suspension || "",
      transmission: entry.transmission || entry.setup_transmission || "",
      aero: entry.aero || entry.setup_aero || "",
      lsd: entry.lsd || entry.setup_lsd || "",
      notes: entry.notes || entry.Notizen || ""
    }
  };
}

function importSetupJson(text) {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error("JSON muss ein Array sein.");
  const entries = raw.map(normalizeSetupEntry).filter((entry) => entry.car && entry.track);
  setupDb = [...setupDb, ...entries];
  saveSetupDb();
}

function importSetupCsv(text) {
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim());
  const entries = rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((key, index) => {
      obj[key] = row[index];
    });
    return normalizeSetupEntry(obj);
  });

  setupDb = [...setupDb, ...entries.filter((entry) => entry.car && entry.track)];
  saveSetupDb();
}

function handleSetupImport() {
  const file = elements.setupImport.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (file.name.endsWith(".json")) {
        importSetupJson(reader.result);
      } else {
        importSetupCsv(reader.result);
      }
      elements.setupImport.value = "";
      elements.setupMatches.innerHTML = "<div class=\"muted\">Import erfolgreich.</div>";
      renderSetupMatches();
    } catch (error) {
      elements.setupMatches.innerHTML = `<div class=\"muted\">Import fehlgeschlagen: ${error.message}</div>`;
    }
  };
  reader.readAsText(file);
}

function exportSetups() {
  const blob = new Blob([JSON.stringify(setupDb, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gt7-setups.json";
  link.click();
  URL.revokeObjectURL(url);
}

function clearSetups() {
  setupDb = [];
  saveSetupDb();
  elements.setupMatches.innerHTML = "<div class=\"muted\">Setup-Datenbank gelöscht.</div>";
}

function savePreset() {
  const entry = {
    car: elements.carName.value,
    track: elements.trackName.value,
    layout: elements.trackLayout.value,
    weather: elements.weather.value,
    tires: elements.tires.value,
    setup: {
      suspension: elements.presetSuspension.value.trim(),
      transmission: elements.presetTransmission.value.trim(),
      aero: elements.presetAero.value.trim(),
      lsd: elements.presetLsd.value.trim(),
      notes: elements.presetNote.value.trim()
    }
  };

  setupDb.push(entry);
  saveSetupDb();
  elements.presetNote.value = "";
  elements.presetSuspension.value = "";
  elements.presetTransmission.value = "";
  elements.presetAero.value = "";
  elements.presetLsd.value = "";
  elements.setupMatches.innerHTML = "<div class=\"muted\">Preset gespeichert.</div>";
  renderSetupMatches();
}

async function loadMetaTimestamp() {
  try {
    const metaText = await fetchText(DATA_META_REMOTE);
    const meta = JSON.parse(metaText);
    if (meta?.updatetimestamp) {
      elements.dataUpdated.textContent = `Letztes Update: ${meta.updatetimestamp}`;
    }
  } catch (error) {
    elements.dataUpdated.textContent = "Letztes Update: unbekannt";
  }
}

async function loadData() {
  setLoadingState(true);
  try {
    const [carsText, makerText, countryText, courseText, crsbaseText, stockText, swapText] =
      await Promise.all([
        loadCsv("cars.csv"),
        loadCsv("maker.csv"),
        loadCsv("country.csv"),
        loadCsv("course.csv"),
        loadCsv("crsbase.csv"),
        loadCsv("stockperf.csv"),
        loadCsv("engineswaps.csv")
      ]);

    const countries = parseCsv(countryText);
    const makers = parseCsv(makerText);
    const carRows = parseCsv(carsText);
    const courseRows = parseCsv(courseText);
    const crsbaseRows = parseCsv(crsbaseText);
    const stockRows = parseCsv(stockText);
    const swapRows = parseCsv(swapText);

    const countryById = new Map(
      countries.slice(1).map((row) => [row[0], row[1]])
    );
    const makerById = new Map(
      makers.slice(1).map((row) => [row[0], { name: row[1], countryId: row[2] }])
    );
    const baseById = new Map(crsbaseRows.slice(1).map((row) => [row[0], row[1]]));

    cars = carRows.slice(1).map((row) => {
      const maker = makerById.get(row[2]) || { name: "Unknown", countryId: "0" };
      const country = countryById.get(maker.countryId) || "Other";
      return {
        id: row[0],
        name: row[1],
        brand: maker.name,
        country
      };
    });

    stockPerfByCar = new Map();
    stockRows.slice(1).forEach((row) => {
      const carId = row[0];
      const tyre = row[2];
      const pp = toNumber(row[1]);
      if (!stockPerfByCar.has(carId)) {
        stockPerfByCar.set(carId, {});
      }
      stockPerfByCar.get(carId)[tyre] = pp;
    });

    engineSwapsByCar = new Map();
    swapRows.slice(1).forEach((row) => {
      const newCar = row[0];
      const engineName = row[2];
      if (!engineSwapsByCar.has(newCar)) {
        engineSwapsByCar.set(newCar, []);
      }
      engineSwapsByCar.get(newCar).push(engineName);
    });

    const trackByBase = new Map();
    courseRows.slice(1).forEach((row) => {
      const baseId = row[2];
      const baseName = baseById.get(baseId) || "Unknown";
      const country = countryById.get(row[3]) || "Other";
      const layoutName = deriveLayoutName(row[1], baseName);
      const isReverse = row[16] === "1";
      const layout = {
        id: row[0],
        name: isReverse && !layoutName.toLowerCase().includes("reverse")
          ? `${layoutName} Reverse`
          : layoutName,
        length: toNumber(row[5]),
        longestStraight: toNumber(row[6]),
        elevation: toNumber(row[7]),
        altitude: toNumber(row[8]),
        pitLaneDelta: toNumber(row[17]),
        isOval: row[18] === "1",
        corners: toNumber(row[19]),
        noRain: row[20] === "1",
        category: row[4]
      };

      if (!trackByBase.has(baseId)) {
        trackByBase.set(baseId, {
          name: baseName,
          country,
          layouts: []
        });
      }

      trackByBase.get(baseId).layouts.push(layout);
    });

    tracks = Array.from(trackByBase.values()).map((track) => ({
      ...track,
      layouts: track.layouts.sort((a, b) => a.name.localeCompare(b.name))
    }));

    tracks = sortTracks(tracks);
    cars = sortCars(cars);

    elements.dataStatus.textContent =
      "Quelle: GT7Info (Community). Remote wird bei jedem Laden abgefragt.";
  } catch (error) {
    elements.dataStatus.textContent =
      "Fehler beim Laden der Daten. Bitte Seite neu laden oder lokal mit einem Webserver öffnen.";
  } finally {
    setLoadingState(false);
    renderConditions();
    renderCarSelectors();
    renderTrackSelectors();
    applySelectionToFilters();
  }
}

loadSetupDb();
renderConditions();
setLoadingState(true);
loadMetaTimestamp();
loadData();

elements.carCountry.addEventListener("change", () => {
  renderCarSelectors();
  applySelectionToFilters();
});

elements.carBrand.addEventListener("change", () => {
  renderCarSelectors();
  applySelectionToFilters();
});

elements.carFilter.addEventListener("input", renderCarSelectors);

elements.trackCountry.addEventListener("change", () => {
  renderTrackSelectors();
  applySelectionToFilters();
});

elements.trackName.addEventListener("change", () => {
  renderTrackSelectors();
  applySelectionToFilters();
});

elements.trackFilter.addEventListener("input", renderTrackSelectors);

elements.weather.addEventListener("change", applySelectionToFilters);
elements.tires.addEventListener("change", applySelectionToFilters);

elements.setupFilterApply.addEventListener("click", applyFiltersFromUI);
elements.setupFilterReset.addEventListener("click", applySelectionToFilters);
elements.setupFilterCar.addEventListener("change", applyFiltersFromUI);
elements.setupFilterTrack.addEventListener("change", applyFiltersFromUI);
elements.setupFilterLayout.addEventListener("change", applyFiltersFromUI);
elements.setupFilterWeather.addEventListener("change", applyFiltersFromUI);
elements.setupFilterTires.addEventListener("change", applyFiltersFromUI);
elements.setupFilterSearch.addEventListener("input", applyFiltersFromUI);

elements.generate.addEventListener("click", generateSetup);
elements.randomize.addEventListener("click", randomize);
elements.addCar.addEventListener("click", addCar);
elements.addTrack.addEventListener("click", addTrack);

elements.setupImportBtn.addEventListener("click", handleSetupImport);
elements.setupClearBtn.addEventListener("click", clearSetups);
elements.setupExportBtn.addEventListener("click", exportSetups);
elements.presetSave.addEventListener("click", savePreset);
