import { useEffect, useMemo, useRef, useState } from "react";

const DATA_BASE_REMOTE = "https://ddm999.github.io/gt7info/data/db";
const DATA_META_REMOTE = "https://ddm999.github.io/gt7info/data.json";

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

const setupStorageKey = "gt7-setup-db";
const seedSetupData = [
  {
    car: "KTM X-BOW R '12",
    track: "Mount Panorama Circuit",
    layout: "Mount Panorama Motor Racing Circuit",
    weather: "Clear",
    tires: "Comfort Soft",
    setup: {
      suspension: "Front 70 / Rear 80",
      transmission: "Auto 310 km/h",
      aero: "Front 120 / Rear 220",
      lsd: "Init 10 / Accel 20 / Brake 15",
      notes: "Stabil bei schnellen Kurven."
    }
  },
  {
    car: "Bugatti VGT",
    track: "Nürburgring",
    layout: "Nordschleife",
    weather: "Overcast",
    tires: "Racing Soft",
    setup: {
      suspension: "Front 85 / Rear 90",
      transmission: "Auto 340 km/h",
      aero: "Front 150 / Rear 260",
      lsd: "Init 12 / Accel 22 / Brake 18",
      notes: "Mehr Downforce für Pflanzgarten."
    }
  },
  {
    car: "Toyota Supra RZ '97",
    track: "Suzuka Circuit",
    layout: "GP",
    weather: "Clear",
    tires: "Sports Soft",
    setup: {
      suspension: "Front 75 / Rear 85",
      transmission: "Auto 290 km/h",
      aero: "Front 80 / Rear 140",
      lsd: "Init 8 / Accel 18 / Brake 14",
      notes: "Ausbalanciert für S-Kurven."
    }
  }
];

function buildDemoSetups(cars, tracks, count) {
  const entries = [];
  if (!cars.length || !tracks.length) return entries;
  const weatherOptions = weathers;
  const tireOptions = tires;

  for (let i = 0; i < count; i += 1) {
    const car = cars[i % cars.length];
    const track = tracks[i % tracks.length];
    const layout = track.layouts[i % track.layouts.length]?.name || "";
    const weather = weatherOptions[i % weatherOptions.length];
    const tire = tireOptions[i % tireOptions.length];
    entries.push({
      car: car.name,
      track: track.name,
      layout,
      weather,
      tires: tire,
      setup: {
        suspension: `Front ${70 + (i % 8)} / Rear ${80 + (i % 8)}`,
        transmission: `Auto ${280 + (i % 7) * 10} km/h`,
        aero: `Front ${90 + (i % 5) * 10} / Rear ${160 + (i % 6) * 10}`,
        lsd: `Init ${8 + (i % 5)} / Accel ${18 + (i % 7)} / Brake ${12 + (i % 6)}`,
        notes: "Beispiel-Setup. Bitte anpassen."
      }
    });
  }
  return entries;
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

async function fetchText(url, options = {}) {
  const version = options.version;
  const finalUrl = version ? `${url}?v=${encodeURIComponent(version)}` : url;
  const response = await fetch(finalUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${finalUrl}`);
  }
  return response.text();
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

function buildOptions(list, key) {
  return [...new Set(list.map((item) => item[key]).filter(Boolean))].sort();
}

function sortCarsList(list) {
  return [...list].sort((a, b) => {
    return a.country.localeCompare(b.country) ||
      a.brand.localeCompare(b.brand) ||
      a.name.localeCompare(b.name);
  });
}

function mergeLayoutNames(base, extra) {
  const set = new Set(base);
  extra.forEach((name) => set.add(name));
  return [...set].sort((a, b) => a.localeCompare(b));
}

const layoutOverrides = {
  Nurburgring: [
    "Nordschleife",
    "Nordschleife Tourist Layout",
    "24h",
    "GP",
    "Endurance",
    "Sprint"
  ],
  "Nürburgring": [
    "Nordschleife",
    "Nordschleife Tourist Layout",
    "24h",
    "GP",
    "Endurance",
    "Sprint"
  ]
};

const setupSeedKey = "gt7-setup-seeded";
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

export default function App() {
  const trackSectionRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataUpdated, setDataUpdated] = useState("...");

  const [cars, setCars] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [stockPerfByCar, setStockPerfByCar] = useState(new Map());
  const [carSearch, setCarSearch] = useState("");
  const [trackSearch, setTrackSearch] = useState("");

  const [carCountry, setCarCountry] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [carName, setCarName] = useState("");

  const [trackCountry, setTrackCountry] = useState("");
  const [trackName, setTrackName] = useState("");
  const [trackLayout, setTrackLayout] = useState("");

  const [weather, setWeather] = useState(weathers[0]);
  const [tire, setTire] = useState(tires[0]);

  const [setupDb, setSetupDb] = useState([]);
  const [setupFilters, setSetupFilters] = useState({
    car: "",
    track: "",
    layout: "",
    weather: "",
    tires: "",
    search: ""
  });

  const [resultHtml, setResultHtml] = useState("Wähle Optionen und klicke auf Generieren.");
  const [importNote, setImportNote] = useState("");
  const [carImportNote, setCarImportNote] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [assistantLevel, setAssistantLevel] = useState(3);
  const [assistantIssues, setAssistantIssues] = useState({
    understeer: false,
    oversteer: false,
    wheelspin: false,
    braking: false,
    accel: false,
    topspeed: false,
    tirewear: false,
    rain: false
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(setupStorageKey);
      if (stored) {
        setSetupDb(JSON.parse(stored));
      } else {
        localStorage.setItem(setupStorageKey, JSON.stringify(seedSetupData));
        setSetupDb(seedSetupData);
      }
    } catch (error) {
      localStorage.removeItem(setupStorageKey);
      localStorage.setItem(setupStorageKey, JSON.stringify(seedSetupData));
      setSetupDb(seedSetupData);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let versionToken = Date.now().toString();
        try {
          const metaText = await fetchText(DATA_META_REMOTE);
          const meta = JSON.parse(metaText);
          if (meta?.updatetimestamp) {
            setDataUpdated(meta.updatetimestamp);
            versionToken = meta.updatetimestamp;
          } else {
            setDataUpdated("unbekannt");
          }
        } catch {
          setDataUpdated("unbekannt");
        }

        const [carsText, makerText, countryText, courseText, crsbaseText, stockText] =
          await Promise.all([
            fetchText(`${DATA_BASE_REMOTE}/cars.csv`, { version: versionToken }),
            fetchText(`${DATA_BASE_REMOTE}/maker.csv`, { version: versionToken }),
            fetchText(`${DATA_BASE_REMOTE}/country.csv`, { version: versionToken }),
            fetchText(`${DATA_BASE_REMOTE}/course.csv`, { version: versionToken }),
            fetchText(`${DATA_BASE_REMOTE}/crsbase.csv`, { version: versionToken }),
            fetchText(`${DATA_BASE_REMOTE}/stockperf.csv`, { version: versionToken })
          ]);

        const countries = parseCsv(countryText);
        const makers = parseCsv(makerText);
        const carRows = parseCsv(carsText);
        const courseRows = parseCsv(courseText);
        const crsbaseRows = parseCsv(crsbaseText);
        const stockRows = parseCsv(stockText);

        const countryById = new Map(countries.slice(1).map((row) => [row[0], row[1]]));
        const makerById = new Map(makers.slice(1).map((row) => [row[0], { name: row[1], countryId: row[2] }]));
        const baseById = new Map(crsbaseRows.slice(1).map((row) => [row[0], row[1]]));
        const makerCountryOverrides = new Map([
          ["Bugatti", "France"]
        ]);

        const carList = carRows.slice(1).map((row) => {
          const maker = makerById.get(row[2]) || { name: "Unknown", countryId: "0" };
          const country = makerCountryOverrides.get(maker.name) || countryById.get(maker.countryId) || "Other";
          return {
            id: row[0],
            name: row[1],
            brand: maker.name,
            country
          };
        });

        const stockMap = new Map();
        stockRows.slice(1).forEach((row) => {
          const carId = row[0];
          const tyre = row[2];
          const pp = toNumber(row[1]);
          if (!stockMap.has(carId)) stockMap.set(carId, {});
          stockMap.get(carId)[tyre] = pp;
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
            corners: toNumber(row[19]),
            elevation: toNumber(row[7]),
            noRain: row[20] === "1"
          };

          if (!trackByBase.has(baseId)) {
            trackByBase.set(baseId, { name: baseName, country, layouts: [] });
          }
          trackByBase.get(baseId).layouts.push(layout);
        });

        const trackList = Array.from(trackByBase.values()).map((track) => ({
          ...track,
          layouts: track.layouts.sort((a, b) => a.name.localeCompare(b.name))
        }));

        carList.sort((a, b) => a.country.localeCompare(b.country) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
        trackList.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

        setCars(carList);
        setTracks(trackList);
        setStockPerfByCar(stockMap);
      } catch (err) {
        setError("Daten konnten nicht geladen werden. Bitte später erneut versuchen oder Seite neu laden.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!cars.length || !tracks.length) return;
    if (localStorage.getItem(setupSeedKey) === "1") return;
    const demo = buildDemoSetups(cars, tracks, 60);
    if (!demo.length) return;
    const nextDb = [...setupDb, ...demo];
    localStorage.setItem(setupStorageKey, JSON.stringify(nextDb));
    localStorage.setItem(setupSeedKey, "1");
    setSetupDb(nextDb);
  }, [cars, tracks]);

  useEffect(() => {
    if (!cars.length) return;
    const filtered = carSearch
      ? cars.filter((c) => c.name.toLowerCase().includes(carSearch.toLowerCase()))
      : cars;
    const countries = buildOptions(filtered, "country");
    const nextCountry = carCountry || countries[0] || "";
    setCarCountry(nextCountry);

    const brands = buildOptions(filtered.filter((c) => c.country === nextCountry), "brand");
    const nextBrand = carBrand || brands[0] || "";
    setCarBrand(nextBrand);

    const names = filtered.filter((c) => c.country === nextCountry && c.brand === nextBrand).map((c) => c.name);
    const nextName = carName || names[0] || "";
    setCarName(nextName);
  }, [cars, carSearch]);

  useEffect(() => {
    if (!tracks.length) return;
    const filtered = trackSearch
      ? tracks.filter((t) => t.name.toLowerCase().includes(trackSearch.toLowerCase()))
      : tracks;
    const countries = buildOptions(filtered, "country");
    const nextCountry = trackCountry || countries[0] || "";
    setTrackCountry(nextCountry);

    const names = filtered.filter((t) => t.country === nextCountry).map((t) => t.name);
    const nextName = trackName || names[0] || "";
    setTrackName(nextName);

    const layouts = filtered.find((t) => t.name === nextName)?.layouts ?? [];
    const nextLayout = trackLayout || (layouts[0]?.name || "");
    setTrackLayout(nextLayout);
  }, [tracks, trackSearch]);

  useEffect(() => {
    if (!tracks.length) return;
    const names = tracks.filter((t) => t.country === trackCountry).map((t) => t.name);
    if (!names.includes(trackName)) {
      setTrackName(names[0] || "");
      setTrackLayout("");
    }
  }, [tracks, trackCountry, trackName]);

  useEffect(() => {
    setSetupFilters({
      car: carName,
      track: trackName,
      layout: trackLayout,
      weather,
      tires: tire,
      search: ""
    });
    setImportNote("");
  }, [carName, trackName, trackLayout, weather, tire]);

  const filteredCars = useMemo(() => {
    if (!carSearch) return cars;
    return cars.filter((c) => c.name.toLowerCase().includes(carSearch.toLowerCase()));
  }, [cars, carSearch]);

  const filteredTracks = useMemo(() => {
    if (!trackSearch) return tracks;
    return tracks.filter((t) => t.name.toLowerCase().includes(trackSearch.toLowerCase()));
  }, [tracks, trackSearch]);

  const carCountries = buildOptions(filteredCars, "country");
  const carBrands = buildOptions(filteredCars.filter((c) => c.country === carCountry), "brand");
  const carNames = filteredCars.filter((c) => c.country === carCountry && c.brand === carBrand).map((c) => c.name);

  const trackCountries = buildOptions(filteredTracks, "country");
  const trackNames = filteredTracks.filter((t) => t.country === trackCountry).map((t) => t.name);
  const baseLayouts =
    tracks.find((t) => t.name === trackName && t.country === trackCountry)?.layouts.map((l) => l.name) ?? [];
  const trackLayouts =
    trackCountry === "Germany" && layoutOverrides[trackName]
      ? mergeLayoutNames(baseLayouts, layoutOverrides[trackName])
      : baseLayouts;

  useEffect(() => {
    const exactTrack = tracks.find((t) => t.name === trackName && t.country === trackCountry);
    if (!exactTrack) return;
    if (!exactTrack.layouts.find((layout) => layout.name === trackLayout)) {
      setTrackLayout(exactTrack.layouts[0]?.name || "");
    }
  }, [tracks, trackName, trackCountry, trackLayout]);

  const selectionPreview = (
    <div className="preview-card">
      <div><strong>Auto:</strong> {carCountry} / {carBrand} / {carName}</div>
      <div><strong>Strecke:</strong> {trackCountry} / {trackName} / {trackLayout}</div>
      <div><strong>Bedingungen:</strong> {weather} · {tire}</div>
    </div>
  );

  const setupCarOptions = useMemo(() => buildOptions(cars, "name"), [cars]);
  const setupTrackOptions = useMemo(() => buildOptions(tracks, "name"), [tracks]);
  const setupLayoutOptions = useMemo(() => {
    if (!tracks.length) return [];
    if (setupFilters.track) {
      const selectedTrack = tracks.find((t) => t.name === setupFilters.track);
      return selectedTrack ? selectedTrack.layouts.map((layout) => layout.name) : [];
    }
    return [...new Set(tracks.flatMap((t) => t.layouts.map((layout) => layout.name)))].sort();
  }, [tracks, setupFilters.track]);
  const setupWeatherOptions = weathers;
  const setupTireOptions = tires;

  const setupMatches = useMemo(() => {
    if (!setupDb.length) return [];
    const activeFilters = ["car", "track", "layout", "weather", "tires"].filter(
      (key) => setupFilters[key]
    );
    const search = setupFilters.search.trim().toLowerCase();

    return setupDb
      .map((raw) => {
        const entry = normalizeSetupEntry(raw);
        if (!entry.car || !entry.track) return null;
        const fieldMatches = activeFilters.map((key) => entry[key] === setupFilters[key]);
        const fieldMatchCount = fieldMatches.filter(Boolean).length;

        const searchOk = !search
          ? true
          : [entry.car, entry.track, entry.layout, entry.setup?.notes]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search);

        const exact =
          (activeFilters.length ? fieldMatchCount === activeFilters.length : true) &&
          (search ? searchOk : true);

        const include =
          (!activeFilters.length && !search) ||
          (search && searchOk) ||
          fieldMatchCount > 0;

        if (!include) return null;

        let score = 0;
        if (setupFilters.car && entry.car === setupFilters.car) score += 3;
        if (setupFilters.track && entry.track === setupFilters.track) score += 3;
        if (setupFilters.layout && entry.layout === setupFilters.layout) score += 2;
        if (setupFilters.weather && entry.weather === setupFilters.weather) score += 1;
        if (setupFilters.tires && entry.tires === setupFilters.tires) score += 1;
        if (search && searchOk) score += 1;

        return { entry, exact, score };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        const carCompare = (a.entry.car || "").localeCompare(b.entry.car || "");
        if (carCompare !== 0) return carCompare;
        return (a.entry.track || "").localeCompare(b.entry.track || "");
      });
  }, [setupDb, setupFilters]);

  const assistantAdvice = useMemo(() => {
    const level = Math.max(1, Math.min(5, Number(assistantLevel) || 3));
    const advice = [];

    if (assistantIssues.wheelspin) {
      advice.push(`Wheelspin: LSD Accel +${level * 2}, Initial +${level}, 1./2. Gang verlängern.`);
    }
    if (assistantIssues.understeer) {
      advice.push(`Untersteuern: Front-Stabi weicher, Front-Downforce +${level * 5}, Rear-Downforce -${level * 3}.`);
    }
    if (assistantIssues.oversteer) {
      advice.push(`Übersteuern: Rear-Stabi weicher, Rear-Downforce +${level * 5}, LSD Accel +${level}.`);
    }
    if (assistantIssues.braking) {
      advice.push(`Bremsstabilität: Brake Bias +${level} nach vorn, LSD Brake +${level}.`);
    }
    if (assistantIssues.accel) {
      advice.push(`Schwacher Kurvenausgang: 2./3. Gang kürzer, LSD Accel -${level}.`);
    }
    if (assistantIssues.topspeed) {
      advice.push(`Top-Speed fehlt: Getriebe länger, Rear-Downforce -${level * 5}.`);
    }
    if (assistantIssues.tirewear) {
      advice.push(`Reifenverschleiß: Sturz reduzieren, weichere Stabis, ABS +${level}.`);
    }
    if (assistantIssues.rain) {
      advice.push(`Regen: Fahrwerk weicher, Bodenfreiheit +${level * 2}, IM/W Reifen nutzen.`);
    }

    if (!advice.length) {
      advice.push("Wähle ein Problem, um Empfehlungen zu sehen.");
    }

    return advice;
  }, [assistantIssues, assistantLevel]);

  useEffect(() => {
    if (setupFilters.layout && !setupLayoutOptions.includes(setupFilters.layout)) {
      setSetupFilters((prev) => ({ ...prev, layout: "" }));
    }
  }, [setupLayoutOptions, setupFilters.layout]);

  const handleGenerate = () => {
    const car = cars.find((c) => c.name === carName && c.brand === carBrand);
    const track = tracks.find((t) => t.name === trackName);
    const layout = track?.layouts.find((l) => l.name === trackLayout);
    const tireCode = tireCodeMap[tire];
    const pp = car ? stockPerfByCar.get(car.id)?.[tireCode] : null;
    const bestSetup = setupMatches[0]?.entry || null;

    setResultHtml(`
      <div class="gt7-card">
        <div class="gt7-header">
          <div class="gt7-title">Setup Sheet</div>
          <div class="gt7-meta">${trackName} · ${trackLayout}</div>
          <div class="gt7-meta">${weather} · ${tire}</div>
        </div>
        <div class="gt7-grid">
          <div class="gt7-panel">
            <div class="gt7-panel__title">Auto</div>
            <div class="gt7-row"><span>Land</span><strong>${carCountry}</strong></div>
            <div class="gt7-row"><span>Marke</span><strong>${carBrand}</strong></div>
            <div class="gt7-row"><span>Modell</span><strong>${carName}</strong></div>
            <div class="gt7-row"><span>PP (Serie)</span><strong>${pp ? pp.toFixed(2) : "-"}</strong></div>
          </div>
          <div class="gt7-panel">
            <div class="gt7-panel__title">Strecke</div>
            <div class="gt7-row"><span>Land</span><strong>${trackCountry}</strong></div>
            <div class="gt7-row"><span>Name</span><strong>${trackName}</strong></div>
            <div class="gt7-row"><span>Layout</span><strong>${trackLayout}</strong></div>
            <div class="gt7-row"><span>Länge</span><strong>${layout?.length ?? "-"} m</strong></div>
            <div class="gt7-row"><span>Kurven</span><strong>${layout?.corners ?? "-"}</strong></div>
            <div class="gt7-row"><span>Höhenmeter</span><strong>${layout?.elevation ?? "-"} m</strong></div>
            <div class="gt7-row"><span>Regen erlaubt</span><strong>${layout ? (layout.noRain ? "Nein" : "Ja") : "-"}</strong></div>
          </div>
          <div class="gt7-panel">
            <div class="gt7-panel__title">Setup (geladen)</div>
            ${
              bestSetup
                ? `
              <div class="gt7-row"><span>Fahrwerk</span><strong>${bestSetup.setup?.suspension || "-"}</strong></div>
              <div class="gt7-row"><span>Getriebe</span><strong>${bestSetup.setup?.transmission || "-"}</strong></div>
              <div class="gt7-row"><span>Aero</span><strong>${bestSetup.setup?.aero || "-"}</strong></div>
              <div class="gt7-row"><span>LSD</span><strong>${bestSetup.setup?.lsd || "-"}</strong></div>
              <div class="gt7-row"><span>Notizen</span><strong>${bestSetup.setup?.notes || "-"}</strong></div>
                `
                : `<div class="gt7-empty">Kein passendes Setup gefunden.</div>`
            }
          </div>
        </div>
      </div>
    `);

    if (trackSectionRef.current) {
      trackSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="app">
      <div className="bg"></div>
      <header className="hero">
        <div className="hero__content">
          <p className="kicker">Gran Turismo 7</p>
          <h1>Setup Generator</h1>
          <p className="sub">Sortiert nach Land und Marke. Wähle Auto, Strecke, Layout, Wetter und Reifen.</p>
        </div>
        <div className="hero__panel">
          <div className="stat">
            <span className="stat__label">Modus</span>
            <span className="stat__value">Datenbank</span>
          </div>
          <div className="stat">
            <span className="stat__label">Ansicht</span>
            <span className="stat__value">Generator</span>
          </div>
        </div>
      </header>

      {error && <div className="banner is-visible">{error}</div>}
      {loading && <div className="loading is-visible">Lädt Daten …</div>}

      <main className="grid">
        <section className="card">
          <h2>Auto</h2>
          <div className="field">
            <label>Land</label>
            <select value={carCountry} onChange={(e) => setCarCountry(e.target.value)}>
              {carCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Marke</label>
            <select value={carBrand} onChange={(e) => setCarBrand(e.target.value)}>
              {carBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Auto</label>
            <select value={carName} onChange={(e) => { setCarName(e.target.value); trackSectionRef.current?.scrollIntoView({ behavior: "smooth" }); }}>
              {carNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Suche</label>
            <input value={carSearch} onChange={(e) => setCarSearch(e.target.value)} placeholder="z. B. Supra" />
          </div>
        </section>

        <section className="card" ref={trackSectionRef}>
          <h2>Strecke</h2>
          <div className="field">
            <label>Land</label>
            <select value={trackCountry} onChange={(e) => setTrackCountry(e.target.value)}>
              {trackCountries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Strecke</label>
            <select value={trackName} onChange={(e) => setTrackName(e.target.value)}>
              {trackNames.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Layout</label>
            <select value={trackLayout} onChange={(e) => setTrackLayout(e.target.value)}>
              {trackLayouts.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Suche</label>
            <input value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} placeholder="z. B. Suzuka" />
          </div>
        </section>

        <section className="card">
          <h2>Bedingungen</h2>
          <div className="field">
            <label>Wetter</label>
            <select value={weather} onChange={(e) => setWeather(e.target.value)}>
              {weathers.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Reifen</label>
            <select value={tire} onChange={(e) => setTire(e.target.value)}>
              {tires.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button className="primary" onClick={handleGenerate}>Setup generieren</button>
          </div>
        </section>

        <section className="card result">
          <h2>Dein Setup</h2>
          <div className="result__box" dangerouslySetInnerHTML={{ __html: resultHtml }} />
        </section>

        <section className="card">
          <h2>Auswahl</h2>
          {selectionPreview}
        </section>

        <section className="card">
          <h2>Setup-Assistent</h2>
          <div className="field">
            <label>Stärke</label>
            <input
              type="range"
              min="1"
              max="5"
              value={assistantLevel}
              onChange={(e) => setAssistantLevel(e.target.value)}
            />
          </div>
          <div className="assistant-grid">
            {[
              ["understeer", "Untersteuern"],
              ["oversteer", "Übersteuern"],
              ["wheelspin", "Wheelspin"],
              ["braking", "Bremsen instabil"],
              ["accel", "Kurvenausgang schwach"],
              ["topspeed", "Top-Speed fehlt"],
              ["tirewear", "Reifenverschleiß"],
              ["rain", "Regen-Setup"]
            ].map(([key, label]) => (
              <label key={key} className="assistant-check">
                <input
                  type="checkbox"
                  checked={assistantIssues[key]}
                  onChange={(e) =>
                    setAssistantIssues((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="assistant-output">
            {assistantAdvice.map((line, idx) => (
              <div key={`${line}-${idx}`} className="assistant-line">• {line}</div>
            ))}
          </div>
        </section>

        <section className="card full">
          <h2>Setup-Datenbank</h2>
          <div className="muted">Einträge: {setupDb.length} · Treffer: {setupMatches.length}</div>
          <div className="filters">
            <div className="field">
              <label>Auto</label>
              <select value={setupFilters.car} onChange={(e) => setSetupFilters((prev) => ({ ...prev, car: e.target.value }))}>
                <option value="">Alle</option>
                {setupCarOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Strecke</label>
              <select
                value={setupFilters.track}
                onChange={(e) =>
                  setSetupFilters((prev) => ({ ...prev, track: e.target.value, layout: "" }))
                }
              >
                <option value="">Alle</option>
                {setupTrackOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Layout</label>
              <select value={setupFilters.layout} onChange={(e) => setSetupFilters((prev) => ({ ...prev, layout: e.target.value }))}>
                <option value="">Alle</option>
                {setupLayoutOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Wetter</label>
              <select
                value={setupFilters.weather}
                onChange={(e) => setSetupFilters((prev) => ({ ...prev, weather: e.target.value }))}
              >
                <option value="">Alle</option>
                {setupWeatherOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Reifen</label>
              <select
                value={setupFilters.tires}
                onChange={(e) => setSetupFilters((prev) => ({ ...prev, tires: e.target.value }))}
              >
                <option value="">Alle</option>
                {setupTireOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Freitext</label>
              <input
                value={setupFilters.search}
                onChange={(e) => setSetupFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="z. B. notizen, auto, strecke"
              />
            </div>
          </div>
          <div className="actions">
            <button onClick={() => setSetupFilters((prev) => ({ ...prev }))}>Filter anwenden</button>
            <button
              onClick={() =>
                setSetupFilters({
                  car: carName,
                  track: trackName,
                  layout: trackLayout,
                  weather,
                  tires: tire,
                  search: ""
                })
              }
            >
              Reset
            </button>
          </div>

          <div className="divider"></div>

          <div className="field">
            <label>Setup-Import (JSON/CSV)</label>
            <input
              type="file"
              accept=".json,.csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  let entries = [];
                  if (file.name.endsWith(".json")) {
                    const raw = JSON.parse(text);
                    if (!Array.isArray(raw)) throw new Error("JSON muss ein Array sein.");
                    entries = raw.map(normalizeSetupEntry).filter((entry) => entry.car && entry.track);
                  } else {
                    const rows = parseCsv(text);
                    const header = rows[0]?.map((h) => h.trim()) ?? [];
                    entries = rows
                      .slice(1)
                      .map((row) => {
                        const obj = {};
                        header.forEach((key, index) => {
                          obj[key] = row[index];
                        });
                        return normalizeSetupEntry(obj);
                      })
                      .filter((entry) => entry.car && entry.track);
                  }
                  const nextDb = [...setupDb, ...entries];
                  localStorage.setItem(setupStorageKey, JSON.stringify(nextDb));
                  setSetupDb(nextDb);
                  setImportNote(`Import ok: ${entries.length} Einträge`);
                } catch (err) {
                  setImportNote(`Import fehlgeschlagen: ${err.message}`);
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </div>
          <div className="field">
            <label>Setup-Import per URL (JSON/CSV)</label>
            <input
              value={setupUrl}
              onChange={(e) => setSetupUrl(e.target.value)}
              placeholder="https://.../gt7-setups.json"
            />
          </div>
          <div className="actions">
            <button
              onClick={async () => {
                if (!setupUrl) return;
                try {
                  const response = await fetch(setupUrl, { cache: "no-store" });
                  if (!response.ok) throw new Error("URL konnte nicht geladen werden.");
                  const text = await response.text();
                  let entries = [];
                  if (setupUrl.toLowerCase().endsWith(".json")) {
                    const raw = JSON.parse(text);
                    if (!Array.isArray(raw)) throw new Error("JSON muss ein Array sein.");
                    entries = raw.map(normalizeSetupEntry).filter((entry) => entry.car && entry.track);
                  } else {
                    const rows = parseCsv(text);
                    const header = rows[0]?.map((h) => h.trim()) ?? [];
                    entries = rows
                      .slice(1)
                      .map((row) => {
                        const obj = {};
                        header.forEach((key, index) => {
                          obj[key] = row[index];
                        });
                        return normalizeSetupEntry(obj);
                      })
                      .filter((entry) => entry.car && entry.track);
                  }
                  const nextDb = [...setupDb, ...entries];
                  localStorage.setItem(setupStorageKey, JSON.stringify(nextDb));
                  setSetupDb(nextDb);
                  setImportNote(`Import ok: ${entries.length} Einträge`);
                } catch (err) {
                  setImportNote(`Import fehlgeschlagen: ${err.message}`);
                }
              }}
            >
              URL importieren
            </button>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(setupDb, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "gt7-setups.json";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(setupStorageKey);
                setSetupDb([]);
                setImportNote("Setup-Datenbank gelöscht.");
              }}
            >
              Löschen
            </button>
          </div>
          {importNote && <div className="muted">{importNote}</div>}

          <div className="divider"></div>
          <div className="field">
            <label>Auto-Liste (KudosPrime HTML)</label>
            <input
              type="file"
              accept=".html,.htm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(text, "text/html");
                  const carlist = doc.querySelector("#carlist");
                  if (!carlist) throw new Error("Konnte #carlist nicht finden.");
                  let currentBrand = "";
                  const imported = [];
                  carlist.childNodes.forEach((node) => {
                    if (node.nodeType !== 1) return;
                    if (node.matches("p.groupby")) {
                      const link = node.querySelector("a");
                      if (link?.textContent) currentBrand = link.textContent.trim();
                    } else if (node.matches("div.car")) {
                      const nameEl = node.querySelector("a.name");
                      const imgEl = node.querySelector("img");
                      const name = (nameEl?.textContent || imgEl?.getAttribute("alt") || "").trim();
                      if (currentBrand && name) {
                        imported.push({ brand: currentBrand, name });
                      }
                    }
                  });

                  const countryByBrand = new Map();
                  cars.forEach((car) => {
                    if (!countryByBrand.has(car.brand)) {
                      countryByBrand.set(car.brand, car.country);
                    }
                  });

                  const existing = new Set(cars.map((car) => `${car.brand}|||${car.name}`));
                  const newCars = imported
                    .filter((item) => !existing.has(`${item.brand}|||${item.name}`))
                    .map((item, index) => ({
                      id: `kp-${Date.now()}-${index}`,
                      name: item.name,
                      brand: item.brand,
                      country: countryByBrand.get(item.brand) || "Other"
                    }));

                  const nextCars = sortCarsList([...cars, ...newCars]);
                  setCars(nextCars);
                  setCarImportNote(`KudosPrime-Import: ${newCars.length} neue Autos`);
                } catch (err) {
                  setCarImportNote(`Import fehlgeschlagen: ${err.message}`);
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </div>
          {carImportNote && <div className="muted">{carImportNote}</div>}

          <div className="setup-list">
            {!setupMatches.length && (
              <div className="muted">Keine passenden Setups gefunden.</div>
            )}
            {setupMatches.map(({ entry, score, exact }, idx) => (
              <div key={`${entry.car}-${entry.track}-${entry.layout}-${idx}`} className="setup-card">
                <div className="setup-card__title">
                  <strong>{entry.car}</strong> — {entry.track}{entry.layout ? ` / ${entry.layout}` : ""}
                </div>
                <div className="setup-card__meta">
                  <span>Score: {score}</span>
                  {exact && <span className="badge">Exact Match</span>}
                </div>
                {entry.weather && <div>Wetter: {entry.weather}</div>}
                {entry.tires && <div>Reifen: {entry.tires}</div>}
                {entry.setup?.suspension && <div>Fahrwerk: {entry.setup.suspension}</div>}
                {entry.setup?.transmission && <div>Getriebe: {entry.setup.transmission}</div>}
                {entry.setup?.aero && <div>Aero: {entry.setup.aero}</div>}
                {entry.setup?.lsd && <div>LSD: {entry.setup.lsd}</div>}
                {entry.setup?.notes && <div>Notiz: {entry.setup.notes}</div>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="data-status">Quelle: GT7Info (Community)</div>
        <div className="note">Letztes Update: {dataUpdated}</div>
        <div className="note">Setup-Empfehlungen sind nur möglich, wenn eine Setup-Datenbank vorhanden ist.</div>
      </footer>
    </div>
  );
}
