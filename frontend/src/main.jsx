import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, TileLayer, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const defaultInput = {
  zone_id: "ZONE-01", rainfall_1h: 22, rainfall_6h: 100, rainfall_24h: 230,
  rainfall_72h: 360, soil_moisture: 70, slope: 32, elevation: 1300,
  historical_events: 2, temperature: 20, humidity: 84
};

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(API_KEY ? { "X-API-Key": API_KEY } : {}), ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const body = await res.json(); msg = body.detail || msg; } catch { }
    throw new Error(msg);
  }
  return res.json();
}

function pct(v) { return `${Math.round(v * 100)}%`; }

function riskClass(level = "Low") { return level.toLowerCase().replace(" ", ""); }

function Metric({ label, value, sub }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{sub}</div></div>
}

function Sidebar({ page, setPage, online }) {
  const items = [
    ["command", "Command Center", "⌂"],
    ["map", "Dynamic Risk Map", "◉"],
    ["impact", "Impact Intelligence", "▦"],
    ["simulate", "What-if Simulator", "◇"],
    ["alerts", "Early Warning Center", "!"],
    ["analytics", "Analytics", "▥"],
    ["reports", "Brief & Reports", "▤"]
  ];
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark">K</div><div><b>LandslideGuard</b><span>AI • TEAM KAVACH</span></div></div>
    <div className="online"><i className={online ? "dot" : "dot off"}></i>{online ? "SYSTEM ONLINE" : "BACKEND OFFLINE"}</div>
    <nav>{items.map(([id, label, icon]) => <button key={id} className={page === id ? "nav active" : "nav"} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}</nav>
    <div className="sidebar-foot">Predict • Protect • Prevent<br /><small>Disaster Management</small></div>
  </aside>
}

function Header({ page }) {
  const title = { command: "Command Center", map: "Dynamic GIS Risk Map", impact: "Impact Intelligence", simulate: "What-if Risk Simulator", alerts: "Early Warning Center", analytics: "Prediction Analytics", reports: "Decision Brief & Reports" }[page];
  return <header><div><h1>{title}</h1><p>AI-powered landslide intelligence and decision support</p></div><div className="badge">● DEMO / RESEARCH MODE</div></header>
}

function Command({ zones, onPredict, last, setPage }) {
  const [selected, setSelected] = useState(zones?.zones?.[0]?.id || "ZONE-01");
  const zone = zones?.zones?.find(z => z.id === selected);
  const [input, setInput] = useState({ ...defaultInput });
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const update = (key, value) => setInput(current => ({ ...current, [key]: Number(value) }));
  async function predict(values = input) {
    setLoading(true);
    try { await onPredict({ ...values, zone_id: selected }); setUpdatedAt(new Date()); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => predict(input), 700);
    return () => clearTimeout(timer);
  }, [input, selected, live]);
  const level = last?.risk_level || "Awaiting prediction";
  return <main>
    <section className="hero">
      <div><div className="eyebrow">AI • GIS • EARLY WARNING</div><h2>Know where risk is rising<br /><em>before impact.</em></h2>
        <p>Combine rainfall, soil moisture, terrain and historical evidence into an explainable risk signal and actionable response.</p>
        <div className="actions"><select value={selected} onChange={e => setSelected(e.target.value)}>{zones?.zones?.map(z => <option key={z.id} value={z.id}>{z.id} — {z.name}</option>)}</select><button className="primary" onClick={() => predict()} disabled={loading}>{loading ? "Predicting…" : "Predict Risk →"}</button><button onClick={() => setPage("map")}>Open GIS Map</button></div></div>
      <div className={`risk-orb ${riskClass(last?.risk_level)}`}><span>{last ? pct(last.probability) : "—"}</span><small>{last?.risk_level || "NO SIGNAL"}</small></div>
    </section>
    <section className="live-panel"><div><div className="panel-title">Live sensor feed</div><p>Adjust a signal to refresh the prediction automatically.</p></div><label className="live-toggle"><input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /><span className="toggle-track"></span><b>{live ? "LIVE ON" : "PAUSED"}</b></label><small className="last-updated">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Waiting for first signal"}</small></section>
    <section className="sensor-grid">{[["rainfall_1h", "Rainfall / 1h", 0, 300, "mm"], ["rainfall_24h", "Rainfall / 24h", 0, 1000, "mm"], ["rainfall_72h", "Rainfall / 72h", 0, 1500, "mm"], ["soil_moisture", "Soil moisture", 0, 100, "%"], ["slope", "Slope", 0, 90, "°"], ["humidity", "Humidity", 0, 100, "%"]].map(([key, label, min, max, unit]) => <label className="sensor" key={key}><div><b>{label}</b><span>{input[key]} {unit}</span></div><input type="range" min={min} max={max} value={input[key]} onChange={e => update(key, e.target.value)} /></label>)}</section>
    <div className="metrics">
      <Metric label="CURRENT RISK" value={last ? last.risk_level : "—"} sub={last ? `Probability ${pct(last.probability)}` : "Run a prediction"} />
      <Metric label="CONFIDENCE" value={last ? pct(last.confidence) : "—"} sub="Model confidence indicator" />
      <Metric label="ZONE" value={selected} sub={zone?.name || "Demo zone"} />
      <Metric label="MODEL" value="RF" sub="Random Forest demo model" />
    </div>
    <section className="grid2">
      <div className="panel"><div className="panel-title">Why is the risk changing?</div>{last ? <div className="factors">{last.factors.map((f, i) => <div className="factor" key={i}><div><b>{f.feature}</b><span>{f.value}</span></div><div className="bar"><i style={{ width: `${Math.min(100, 20 + Math.abs(f.contribution) * 1000)}%` }}></i></div><small>{f.direction}</small></div>)}</div> : <div className="empty">Prediction explanations appear here.</div>}</div>
      <div className="panel"><div className="panel-title">Operational recommendation</div><div className="recommend">{last ? <><div className={`level ${riskClass(last.risk_level)}`}>{last.risk_level} RISK</div><p>{last.recommendation}</p><button onClick={() => setPage("alerts")}>Open Warning Center →</button></> : <div className="empty">Run a prediction to generate a recommendation.</div>}</div></div>
    </section>
    <div className="notice">⚠ <b>Important:</b> Included model/data are for software demonstration and research. Do not use this demo as an official real-world warning system.</div>
  </main>
}

function RiskMap({ zones, last }) {
  const [filter, setFilter] = useState("all");
  const list = zones?.zones || [];
  const mapText = { all: "All zones / सभी क्षेत्र", high: "High and very high / उच्च और बहुत उच्च", low: "Low and moderate / कम और मध्यम", live: "Live model risk / लाइव मॉडल जोखिम", baseline: "Baseline demo risk / आधारभूत डेमो जोखिम", assets: "Exposed assets / प्रभावित परिसंपत्तियां" };
  const riskFor = (zone) => last?.zone_id === zone.id ? last.probability : zone.risk;
  const riskLabel = (live) => live ? mapText.live : mapText.baseline;
  const shown = list.filter(z => { const risk = riskFor(z); return filter === "all" || (filter === "high" ? risk >= .45 : risk < .45) });
  return <main><div className="toolbar"><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{mapText.all}</option><option value="high">{mapText.high}</option><option value="low">{mapText.low}</option></select><span className="map-status"><i className={last ? "pulse" : "pulse idle"}></i>{last ? `LIVE MODEL / लाइव मॉडल • ${last.zone_id} at ${pct(last.probability)}` : "BASELINE DEMO LAYER / आधारभूत डेमो परत"} • {shown.length} zones / क्षेत्र</span></div>
    <div className="map-wrap"><MapContainer center={[27.985, 86.92]} zoom={11} scrollWheelZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" /><TileLayer attribution='&copy; OpenStreetMap contributors &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png" />{shown.map(z => { const risk = riskFor(z); const live = last?.zone_id === z.id; return <React.Fragment key={z.id}><Circle center={z.center} radius={live ? 2800 : 2400} pathOptions={{ color: risk >= .65 ? "#ff4d6d" : risk >= .45 ? "#ffb020" : risk >= .25 ? "#4cc9a0" : "#3b82f6", fillOpacity: live ? .38 : .25, weight: live ? 4 : 2 }}><Popup><b>{z.id}</b><br />{z.name}<br />{riskLabel(live)}: {pct(risk)}<br />{mapText.assets}: {z.assets.length}</Popup></Circle><Marker position={z.center}><Popup><b>{z.name}</b><br />{riskLabel(live)}: {pct(risk)}<br />{mapText.assets}: {z.assets.length}</Popup></Marker></React.Fragment> })}</MapContainer></div>
    <section className="zone-table-wrap"><div className="panel-title">Zone risk table</div><div className="table-scroll"><table><thead><tr><th>ZONE</th><th>RISK</th><th>SIGNAL</th><th>EXPOSED ASSETS</th><th>STATUS</th></tr></thead><tbody>{shown.map(z => { const risk = riskFor(z); const live = last?.zone_id === z.id; const level = risk >= .65 ? "Critical" : risk >= .45 ? "High" : risk >= .25 ? "Moderate" : "Low"; return <tr key={z.id}><td><b>{z.id}</b><span>{z.name}</span></td><td><strong className={`table-risk ${riskClass(level)}`}>{pct(risk)}</strong></td><td>{live ? <span className="live-cell"><i className="pulse"></i>Live model</span> : "Baseline demo"}</td><td>{z.assets.length}</td><td><span className={`table-level ${riskClass(level)}`}>{level}</span></td></tr> })}</tbody></table></div></section>
    <div className="zone-grid">{list.map(z => { const risk = riskFor(z); const live = last?.zone_id === z.id; return <div className={`zone-card ${live ? "live-zone" : ""}`} key={z.id}><div><b>{z.id}</b>{live && <small className="live-chip">LIVE</small>}<span>{z.name}</span></div><strong>{pct(risk)}</strong><small>{live ? "Current model signal" : "Baseline demo risk"} • {z.assets.length} assets</small></div> })}</div>
  </main>
}

function Simulator({ onSimulate }) {
  const [input, setInput] = useState(defaultInput);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const update = (k, v) => setInput(x => ({ ...x, [k]: Number(v) }));
  async function run() { const pressure = 0.5 + (runCount % 5) * 0.25; setLoading(true); setRunCount(count => count + 1); try { setResult(await onSimulate({ ...input, scenario_pressure: pressure })) } catch (e) { alert(e.message) } finally { setLoading(false) } }
  const pressureLabel = result?.scenario_inputs?.scenario_pressure ? `${Math.round(result.scenario_inputs.scenario_pressure * 100)}% storm pressure` : "First run starts at 50%";
  return <main><section className="sim-intro"><div><div className="eyebrow">DECISION LAB / WHAT-IF</div><h2>Test the next storm before it arrives.</h2><p>Each run advances storm pressure from 50% to 150%, making repeated demonstrations visibly progressive.</p></div><div className="sim-mark">ΔRISK</div></section><section className="sim-grid"><div className="panel"><div className="panel-title">Scenario controls</div>{[["rainfall_24h", "24h rainfall", 0, 600, "mm"], ["rainfall_72h", "72h rainfall", 0, 1000, "mm"], ["soil_moisture", "soil moisture", 0, 100, "%"], ["slope", "slope", 0, 60, "°"], ["historical_events", "historical events", 0, 10, "events"]].map(([k, l, min, max, u]) => <label className="slider" key={k}><div><b>{l}</b><span>{input[k]} {u}</span></div><input type="range" min={min} max={max} value={input[k]} onChange={e => update(k, e.target.value)} /></label>)}<div className="pressure-readout">Next run: <b>{runCount % 5 === 0 ? 50 : (runCount % 5) * 25 + 50}% storm pressure</b></div><button className="primary full" onClick={run} disabled={loading}>{loading ? "Simulating…" : `Run Stress Scenario ${runCount + 1}`}</button></div>
    <div className="panel"><div className="panel-title">Scenario outcome</div>{result ? <><div className="compare"><div><small>CURRENT SIGNAL</small><b>{pct(result.baseline.probability)}</b><span>{result.baseline.risk_level}</span></div><div className="arrow">→</div><div><small>STRESSED SIGNAL</small><b>{pct(result.scenario.probability)}</b><span>{result.scenario.risk_level}</span></div></div><div className="pressure-badge">{pressureLabel}</div><div className="risk-compare"><span>Current</span><i><em style={{ width: `${result.baseline.probability * 100}%` }}></em></i><span>{pct(result.baseline.probability)}</span><i><em className="stress" style={{ width: `${result.scenario.probability * 100}%` }}></em></i><span>{pct(result.scenario.probability)}</span></div><div className="delta">Risk change: <b>{result.change > 0 ? "+" : ""}{result.change} percentage points</b></div><p className="recommend-text">{result.scenario.recommendation}</p><div className="notice">The scenario uses the same validated API with transparent stress assumptions. It is a what-if simulation, not a forecast.</div></> : <div className="empty">Adjust conditions and run a scenario.</div>}</div></section></main>
}

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api("/api/alerts").then(setAlerts).catch(() => { }).finally(() => setLoading(false)) }, []);
  return <main><div className="alert-head"><div><h2>Early Warning Queue</h2><p>Warnings are generated from model predictions above the configured high-risk threshold.</p></div><button onClick={() => api("/api/alerts").then(setAlerts)}>Refresh</button></div>{loading ? <div className="empty">Loading…</div> : alerts.length ? <div className="alert-list">{alerts.map(a => <div className={`alert-card ${riskClass(a.risk_level)}`} key={a.id}><div className="alert-icon">!</div><div><b>{a.title}</b><span>{a.zone_id} • {new Date(a.created_at).toLocaleString()}</span><p>{a.action}</p></div><strong>{pct(a.probability)}</strong></div>)}</div> : <div className="empty">No high-risk predictions have been generated yet. Run a prediction from Command Center.</div>}<div className="notice">Warnings shown here are software-generated demo alerts. Connect validated real-time data and approved notification channels before operational use.</div></main>
}

function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/api/analytics").then(setData).catch(() => { }) }, []);
  const chart = useMemo(() => [...(data?.history || [])].reverse().map((x, i) => ({ name: i + 1, risk: Math.round(x.probability * 100) })), [data]);
  return <main><div className="metrics"><Metric label="ACCURACY" value={data ? Math.round(data.metrics.accuracy * 100) + "%" : "—"} sub="Demo holdout set" /><Metric label="PRECISION" value={data ? Math.round(data.metrics.precision * 100) + "%" : "—"} sub="Demo metric" /><Metric label="RECALL" value={data ? Math.round(data.metrics.recall * 100) + "%" : "—"} sub="Important for warnings" /><Metric label="ROC-AUC" value={data ? data.metrics.roc_auc.toFixed(2) : "—"} sub="Demo metric" /></div><section className="panel chart"><div className="panel-title">Prediction history</div><ResponsiveContainer width="100%" height={300}><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="risk" strokeWidth={3} /></LineChart></ResponsiveContainer></section><section className="metrics"><Metric label="RISK TREND" value={data ? `${data.trend_change > 0 ? "+" : ""}${data.trend_change} pts` : "—"} sub="First to latest sample" /><Metric label="MODEL VERSION" value={data?.model_version || "—"} sub="Traceable artifact" /><Metric label="DATA QUALITY" value={data?.data_quality?.status || "—"} sub={data?.data_quality?.coverage || ""} /></section><section className="panel"><div className="panel-title">Validation note</div><p className="muted">The included dataset is synthetic and intentionally small. Metrics are only software-demo indicators. SIH deployment should use geographically and temporally separated validation sets, calibration, uncertainty estimation and domain review.</p></section></main>
}

function Impact({ last, zones }) {
  const zoneId = last?.zone_id || zones?.zones?.[0]?.id || "ZONE-01";
  const [data, setData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  useEffect(() => { const probability = last?.probability || 0; api(`/api/impact?zone_id=${zoneId}&probability=${probability}`).then(setData).catch(() => setData(null)); api(`/api/routes?zone_id=${zoneId}&probability=${probability}`).then(setRouteData).catch(() => setRouteData(null)) }, [zoneId, last?.probability]);
  return <main><div className="impact-hero"><div><div className="eyebrow">POSTGIS-READY EXPOSURE VIEW</div><h2>{data?.zone_name || "Impact intelligence"}</h2><p>Translate a live risk signal into affected infrastructure and population estimates for response prioritisation.</p></div><div className={`risk-orb ${riskClass(data?.risk_level)}`}><span>{data ? pct(data.probability) : "—"}</span><small>{data?.risk_level || "NO SIGNAL"}</small></div></div>{data ? <><div className="metrics"><Metric label="POPULATION AT RISK" value={data.estimated_population.toLocaleString()} sub="Demo exposure estimate" /><Metric label="ASSETS AT RISK" value={data.asset_count} sub="Included GIS assets" /><Metric label="CURRENT ZONE" value={data.zone_id} sub={data.zone_name} /><Metric label="MODEL SIGNAL" value={last ? "LIVE" : "BASELINE"} sub="Evidence source" /></div><section className="panel"><div className="panel-title">Affected infrastructure</div><div className="impact-list">{data.assets.map((asset, i) => <div className="impact-row" key={`${asset.name}-${i}`}><span className="asset-kind">{asset.type}</span><div><b>{asset.name}</b><small>{asset.lat.toFixed(4)}, {asset.lng.toFixed(4)}</small></div><strong>{data.risk_level}</strong></div>)}</div></section>{routeData && <section className="panel route-panel"><div className="panel-title">Emergency route intelligence</div>{routeData.routes.length ? routeData.routes.map(route => <div className="route-row" key={route.name}><div><b>{route.name}</b><small>{route.type} • {route.reason}</small></div><strong className={route.status === "Restrict and inspect" ? "route-danger" : "route-watch"}>{route.status}</strong></div>) : <div className="empty">No road or bridge assets in this zone.</div>}<div className="route-note"><b>Alternative route:</b> {routeData.alternative_route}</div></section>}<div className="notice">{data.method}</div></> : <div className="empty">Waiting for a prediction signal.</div>}</main>
}

function Reports({ last, zones }) {
  const zoneId = last?.zone_id || zones?.zones?.[0]?.id || "ZONE-01";
  const [brief, setBrief] = useState(null);
  useEffect(() => { api(`/api/brief?zone_id=${zoneId}&probability=${last?.probability || 0}&risk_level_value=${encodeURIComponent(last?.risk_level || "Low")}`).then(setBrief).catch(() => setBrief(null)) }, [zoneId, last?.probability, last?.risk_level]);
  function print() { window.print() }
  return <main><section className="report-toolbar"><div><div className="eyebrow">EVIDENCE-BOUNDED DECISION SUPPORT</div><h2>Disaster brief</h2><p>Generated only from the current model signal and included demonstration evidence.</p></div><button className="primary" onClick={print}>Print / Export PDF</button></section>{brief ? <section className="report-sheet"><div className="report-meta"><span>{brief.zone_id}</span><span>{new Date(brief.generated_at).toLocaleString()}</span></div><h2>{brief.title}</h2><div className={`level ${riskClass(brief.risk_level)}`}>{brief.risk_level} RISK • {pct(brief.probability)}</div><p className="brief-copy">{brief.brief}</p><div className="panel report-action"><div className="panel-title">Recommended action</div><p>{brief.recommended_actions}</p></div><div className="notice">Demo limitation: this report is not an official warning. Operational deployment requires validated data, authorised thresholds, audit logs and domain approval.</div></section> : <div className="empty">Waiting for a prediction signal.</div>}</main>
}

export default function App() {
  const [page, setPage] = useState("command");
  const [zones, setZones] = useState({ zones: [] });
  const [last, setLast] = useState(null);
  const [online, setOnline] = useState(false);
  useEffect(() => { api("/api/health").then(x => setOnline(x.status === "ok" && x.model_ready)).catch(() => setOnline(false)); api("/api/zones").then(setZones).catch(() => { }) }, []);
  async function predict(input) { const r = await api("/api/predict", { method: "POST", body: JSON.stringify(input) }); setLast(r); return r }
  async function simulate(input) { return api("/api/simulate", { method: "POST", body: JSON.stringify(input) }) }
  return <div className="app"><Sidebar page={page} setPage={setPage} online={online} /><div className="content"><Header page={page} />{page === "command" && <Command zones={zones} onPredict={predict} last={last} setPage={setPage} />} {page === "map" && <RiskMap zones={zones} last={last} />} {page === "impact" && <Impact zones={zones} last={last} />} {page === "simulate" && <Simulator onSimulate={simulate} />} {page === "alerts" && <Alerts />} {page === "analytics" && <Analytics />} {page === "reports" && <Reports zones={zones} last={last} />}</div></div>
}
createRoot(document.getElementById("root")).render(<App />);
