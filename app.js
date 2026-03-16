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
  setupMatches: document.getElementById("setupMatches"),
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
}

function saveSetupDb() {
  localStorage.setItem(setupStorageKey, JSON.stringify(setupDb));
  updateSetupCount();
}

function updateSetupCount() {
  elements.setupCount.textContent = `${setupDb.length} Eintraege`;
}

function scoreSetupMatch(entry) {
  const car = elements.carName.value;
  const track = elements.trackName.value;
  const layout = elements.trackLayout.value;
  const weather = elements.weather.value;
  const tire = elements.tires.value;

  let score = 0;
  if (entry.car === car) score += 3;
  if (entry.track === track) score += 3;
  if (entry.layout && entry.layout === layout) score += 2;
  if (entry.weather && entry.weather === weather) score += 1;
  if (entry.tires && entry.tires === tire) score += 1;

  return score;
}

function renderSetupMatches() {
  const matches = setupDb
    .map((entry) => ({ entry, score: scoreSetupMatch(entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!matches.length) {
    elements.setupMatches.innerHTML = "<div class=\"muted\">Keine passenden Setups gefunden.</div>";
    return;
  }

  elements.setupMatches.innerHTML = matches
    .map(({ entry }) => {
      const parts = [
        `<div><strong>${entry.car}</strong> — ${entry.track}${entry.layout ? ` / ${entry.layout}` : ""}</div>`,
        entry.weather ? `<div>Wetter: ${entry.weather}</div>` : "",
        entry.tires ? `<div>Reifen: ${entry.tires}</div>` : "",
        entry.setup?.suspension ? `<div>Fahrwerk: ${entry.setup.suspension}</div>` : "",
        entry.setup?.transmission ? `<div>Getriebe: ${entry.setup.transmission}</div>` : "",
        entry.setup?.aero ? `<div>Aero: ${entry.setup.aero}</div>` : "",
        entry.setup?.lsd ? `<div>LSD: ${entry.setup.lsd}</div>` : "",
        entry.setup?.notes ? `<div>Notiz: ${entry.setup.notes}</div>` : ""
      ].filter(Boolean);

      return `<div class=\"setup-card\">${parts.join("")}</div>`;
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
    <div><strong>Laenge:</strong> ${layout ? formatNumber(layout.length, " m") : "-"}</div>
    <div><strong>Kurven:</strong> ${layout ? formatNumber(layout.corners) : "-"}</div>
    <div><strong>Hoehenmeter:</strong> ${layout ? formatNumber(layout.elevation, " m") : "-"}</div>
    <div><strong>Regen erlaubt:</strong> ${layout ? (layout.noRain ? "Nein" : "Ja") : "-"}</div>
    <div><strong>Engine Swap:</strong> ${engineSwaps && engineSwaps.length ? engineSwaps.join(", ") : "-"}</div>
  `;

  renderSetupMatches();
}

function randomChoice(list) {
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
  elements.setupMatches.innerHTML = "<div class=\"muted\">Setup-Datenbank geloescht.</div>";
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
      "Fehler beim Laden der Daten. Bitte Seite neu laden oder lokal mit einem Webserver oeffnen.";
  } finally {
    setLoadingState(false);
    renderConditions();
    renderCarSelectors();
    renderTrackSelectors();
  }
}

loadSetupDb();
renderConditions();
setLoadingState(true);
loadMetaTimestamp();
loadData();

elements.carCountry.addEventListener("change", renderCarSelectors);
elements.carBrand.addEventListener("change", renderCarSelectors);
elements.carFilter.addEventListener("input", renderCarSelectors);

elements.trackCountry.addEventListener("change", renderTrackSelectors);
elements.trackName.addEventListener("change", renderTrackSelectors);
elements.trackFilter.addEventListener("input", renderTrackSelectors);

elements.generate.addEventListener("click", generateSetup);
elements.randomize.addEventListener("click", randomize);
elements.addCar.addEventListener("click", addCar);
elements.addTrack.addEventListener("click", addTrack);

elements.setupImportBtn.addEventListener("click", handleSetupImport);
elements.setupClearBtn.addEventListener("click", clearSetups);
elements.setupExportBtn.addEventListener("click", exportSetups);
elements.presetSave.addEventListener("click", savePreset);
