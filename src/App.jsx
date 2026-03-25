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

  const [resultHtml, setResultHtml] = useState("W�hle Optionen und klicke auf Generieren.");

  useEffect(() => {
    const stored = localStorage.getItem(setupStorageKey);
    setSetupDb(stored ? JSON.parse(stored) : []);
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

        const carList = carRows.slice(1).map((row) => {
          const maker = makerById.get(row[2]) || { name: "Unknown", countryId: "0" };
          const country = countryById.get(maker.countryId) || "Other";
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
        setError("Daten konnten nicht geladen werden. Bitte sp�ter erneut versuchen oder Seite neu laden.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
    setSetupFilters({
      car: carName,
      track: trackName,
      layout: trackLayout,
      weather,
      tires: tire,
      search: ""
    });
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
  const trackLayouts = (filteredTracks.find((t) => t.name === trackName)?.layouts ?? []).map((l) => l.name);

  const selectionPreview = (
    <div className="preview-card">
      <div><strong>Auto:</strong> {carCountry} / {carBrand} / {carName}</div>
      <div><strong>Strecke:</strong> {trackCountry} / {trackName} / {trackLayout}</div>
    </div>
  );

  const handleGenerate = () => {
    const car = cars.find((c) => c.name === carName && c.brand === carBrand);
    const track = tracks.find((t) => t.name === trackName);
    const layout = track?.layouts.find((l) => l.name === trackLayout);
    const tireCode = tireCodeMap[tire];
    const pp = car ? stockPerfByCar.get(car.id)?.[tireCode] : null;

    setResultHtml(`
      <div><strong>Auto:</strong> ${carCountry} / ${carBrand} / ${carName}</div>
      <div><strong>Strecke:</strong> ${trackCountry} / ${trackName} / ${trackLayout}</div>
      <div><strong>Wetter:</strong> ${weather}</div>
      <div><strong>Reifen:</strong> ${tire}</div>
      <div><strong>PP (Serie):</strong> ${pp ? pp.toFixed(2) : "-"}</div>
      <div><strong>L�nge:</strong> ${layout?.length ?? "-"} m</div>
      <div><strong>Kurven:</strong> ${layout?.corners ?? "-"}</div>
      <div><strong>H�henmeter:</strong> ${layout?.elevation ?? "-"} m</div>
      <div><strong>Regen erlaubt:</strong> ${layout ? (layout.noRain ? "Nein" : "Ja") : "-"}</div>
    `);

    if (trackSectionRef.current) {
      trackSectionRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      <div className="bg"></div>
      <header className="hero">
        <div className="hero__content">
          <p className="kicker">Gran Turismo 7</p>
          <h1>Setup Generator</h1>
          <p className="sub">Sortiert nach Land und Marke. W�hle Auto, Strecke, Layout, Wetter und Reifen.</p>
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
      {loading && <div className="loading is-visible">L�dt Daten �</div>}

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
            <input value={carSearch} onChange={(e) => setCarSearch(e.target.value)} placeholder="z.?B. Supra" />
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
            <input value={trackSearch} onChange={(e) => setTrackSearch(e.target.value)} placeholder="z.?B. Suzuka" />
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
      </main>

      <footer className="footer">
        <div className="data-status">Quelle: GT7Info (Community)</div>
        <div className="note">Letztes Update: {dataUpdated}</div>
        <div className="note">Setup-Empfehlungen sind nur m�glich, wenn eine Setup-Datenbank vorhanden ist.</div>
      </footer>
    </div>
  );
}
