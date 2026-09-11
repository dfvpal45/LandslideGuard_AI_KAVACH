from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict, deque
import json
import os
import sqlite3
import time
import math
import pandas as pd
import numpy as np

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from model import load_bundle, MODEL_PATH, FEATURES, combined_probability

BASE = Path(__file__).resolve().parent.parent
DB_PATH = BASE / "backend" / "landslideguard.db"
ZONES_PATH = BASE / "data" / "demo_zones.json"
API_KEY = os.getenv("LANDSLIDEGUARD_API_KEY", "").strip()
ADMIN_KEY = os.getenv("LANDSLIDEGUARD_ADMIN_KEY", "demo-admin-key").strip()
allowed_origins = [origin.strip() for origin in os.getenv(
    "LANDSLIDEGUARD_ALLOWED_ORIGINS",
    "https://landslide-guard-ai-kavach-qo1iyqkoy-team-kavach1.vercel.app"
).split(",") if origin.strip()]
allowed_hosts = [host.strip() for host in os.getenv(
    "LANDSLIDEGUARD_ALLOWED_HOSTS", "https://landslideguard-ai-kavach.onrender.com"
).split(",") if host.strip()]
request_log = defaultdict(deque)
RATE_LIMIT = int(os.getenv("LANDSLIDEGUARD_RATE_LIMIT", "120"))
RATE_WINDOW_SECONDS = 60

app = FastAPI(
    title="LandslideGuard AI API",
    version="1.0.0",
    description="Demo disaster-management API for landslide risk prediction."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

@app.middleware("http")
async def security_middleware(request: Request, call_next):
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    timestamps = request_log[client]
    while timestamps and now - timestamps[0] >= RATE_WINDOW_SECONDS:
        timestamps.popleft()
    if len(timestamps) >= RATE_LIMIT:
        return Response("Too many requests", status_code=429, headers={"Retry-After": "60"})
    timestamps.append(now)

    if request.url.path.startswith("/api/") and request.url.path != "/api/health" and API_KEY:
        if request.headers.get("X-API-Key") != API_KEY:
            return Response("Unauthorized", status_code=401)

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Cache-Control"] = "no-store"
    return response

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            zone_id TEXT,
            probability REAL NOT NULL,
            risk_level TEXT NOT NULL,
            payload TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('ADMIN', 'DISASTER_AUTHORITY', 'ANALYST', 'VIEWER')),
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            actor TEXT NOT NULL,
            resource TEXT,
            metadata TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        INSERT OR IGNORE INTO users(email, display_name, role, created_at)
        VALUES('admin@kavach.demo', 'KAVACH Administrator', 'ADMIN', ?)
    """, (datetime.now(timezone.utc).isoformat(),))
    conn.commit()
    conn.close()

init_db()

def load_zones():
    with open(ZONES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def get_model():
    try:
        return load_bundle()
    except FileNotFoundError:
        raise HTTPException(503, "ML model is not initialized. Run: python seed_model.py")

class PredictionInput(BaseModel):
    zone_id: str = "ZONE-01"
    rainfall_1h: float = Field(12, ge=0, le=300)
    rainfall_6h: float = Field(48, ge=0, le=600)
    rainfall_24h: float = Field(120, ge=0, le=1000)
    rainfall_72h: float = Field(210, ge=0, le=1500)
    soil_moisture: float = Field(58, ge=0, le=100)
    slope: float = Field(28, ge=0, le=90)
    elevation: float = Field(1400, ge=0, le=9000)
    historical_events: float = Field(2, ge=0, le=50)
    temperature: float = Field(22, ge=-30, le=60)
    humidity: float = Field(82, ge=0, le=100)
    scenario_pressure: float = Field(1.0, ge=0.5, le=1.5)

def explain(bundle, row):
    model = bundle["model"]
    values = row.iloc[0]
    importances = model.feature_importances_
    # A transparent local contribution heuristic: normalized feature magnitude * model importance.
    med = np.array([50, 150, 250, 400, 55, 30, 1500, 2, 22, 75], dtype=float)
    scales = np.array([100, 250, 400, 600, 60, 45, 3000, 5, 35, 100], dtype=float)
    x = np.array([float(values[f]) for f in FEATURES])
    normalized = np.clip((x - med) / scales, -1, 2)
    scores = normalized * importances
    labels = {
        "rainfall_1h": "1h rainfall",
        "rainfall_6h": "6h rainfall",
        "rainfall_24h": "24h rainfall",
        "rainfall_72h": "72h cumulative rainfall",
        "soil_moisture": "Soil moisture",
        "slope": "Slope",
        "elevation": "Elevation",
        "historical_events": "Historical landslides",
        "temperature": "Temperature",
        "humidity": "Humidity"
    }
    items = []
    for f, score in sorted(zip(FEATURES, scores), key=lambda z: abs(z[1]), reverse=True)[:6]:
        items.append({
            "feature": labels[f],
            "value": round(float(values[f]), 2),
            "contribution": round(float(score), 4),
            "direction": "increases risk" if score >= 0 else "reduces risk"
        })
    return items

def risk_level(p):
    if p >= 0.85: return "Critical"
    if p >= 0.65: return "Very High"
    if p >= 0.45: return "High"
    if p >= 0.25: return "Moderate"
    return "Low"

def recommendation(level):
    return {
        "Critical": "Immediate field verification, restrict vulnerable routes, activate emergency coordination and issue public warning.",
        "Very High": "Prepare evacuation/route controls, increase monitoring and notify district response teams.",
        "High": "Increase monitoring frequency and prepare precautionary response measures.",
        "Moderate": "Continue monitoring rainfall, soil moisture and slope conditions.",
        "Low": "Routine monitoring; no elevated action indicated by this demo model."
    }[level]

def run_prediction(inp: PredictionInput):
    bundle = get_model()
    row = pd.DataFrame([{f: getattr(inp, f) for f in FEATURES}])
    calibrator = bundle.get("calibrator")
    probability = float(combined_probability(bundle["model"], calibrator, row)[0]) if calibrator else float(bundle["model"].predict_proba(row)[0, 1])
    level = risk_level(probability)
    factors = explain(bundle, row)
    confidence = min(0.99, max(0.55, 0.60 + abs(probability - 0.5) * 0.75))
    result = {
        "zone_id": inp.zone_id,
        "probability": round(probability, 4),
        "risk_level": level,
        "confidence": round(confidence, 4),
        "factors": factors,
        "recommendation": recommendation(level),
        "model_metrics": bundle["metrics"],
        "model_type": "Random Forest (demo-trained)",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    conn = db()
    conn.execute(
        "INSERT INTO predictions(created_at,zone_id,probability,risk_level,payload) VALUES(?,?,?,?,?)",
        (result["timestamp"], inp.zone_id, probability, level, json.dumps(result))
    )
    conn.execute(
        "INSERT INTO audit_logs(event_type,actor,resource,metadata,created_at) VALUES(?,?,?,?,?)",
        ("prediction.created", "demo-session", inp.zone_id, json.dumps({"probability": probability, "risk_level": level}), result["timestamp"])
    )
    conn.commit()
    conn.close()
    return result

def require_admin(request: Request):
    if request.headers.get("X-Admin-Key") != ADMIN_KEY:
        raise HTTPException(401, "Admin authentication required")

@app.get("/api/admin/overview")
def admin_overview(request: Request):
    require_admin(request)
    conn = db()
    counts = {
        "users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        "active_users": conn.execute("SELECT COUNT(*) FROM users WHERE active = 1").fetchone()[0],
        "predictions": conn.execute("SELECT COUNT(*) FROM predictions").fetchone()[0],
        "alerts": conn.execute("SELECT COUNT(*) FROM predictions WHERE probability >= 0.65").fetchone()[0],
        "audit_events": conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
    }
    conn.close()
    return {"storage": "sqlite-demo", "production_storage": "PostgreSQL + PostGIS", "counts": counts,
            "security": {"admin_key_configured": bool(ADMIN_KEY), "api_key_configured": bool(API_KEY),
                          "rate_limit_per_minute": RATE_LIMIT}}

@app.get("/api/admin/users")
def admin_users(request: Request):
    require_admin(request)
    conn = db()
    rows = conn.execute("SELECT id, email, display_name, role, active, created_at FROM users ORDER BY id").fetchall()
    conn.close()
    return {"users": [dict(row) for row in rows]}

@app.get("/api/admin/audit")
def admin_audit(request: Request):
    require_admin(request)
    conn = db()
    rows = conn.execute("SELECT id, event_type, actor, resource, metadata, created_at FROM audit_logs ORDER BY id DESC LIMIT 50").fetchall()
    conn.close()
    return {"events": [dict(row) for row in rows]}

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_ready": MODEL_PATH.exists(),
        "database": DB_PATH.exists(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/zones")
def zones():
    return load_zones()

@app.post("/api/predict")
def predict(inp: PredictionInput):
    return run_prediction(inp)

@app.post("/api/simulate")
def simulate(inp: PredictionInput):
    current = run_prediction(inp)
    pressure = inp.scenario_pressure
    stressed = inp.model_copy(update={
        "rainfall_1h": min(300, inp.rainfall_1h * (1 + 0.35 * pressure) + 5 * pressure),
        "rainfall_6h": min(600, inp.rainfall_6h * (1 + 0.30 * pressure) + 10 * pressure),
        "rainfall_24h": min(1000, inp.rainfall_24h * (1 + 0.25 * pressure) + 20 * pressure),
        "rainfall_72h": min(1500, inp.rainfall_72h * (1 + 0.20 * pressure) + 30 * pressure),
        "soil_moisture": min(100, inp.soil_moisture + 12 * pressure)
    })
    scenario = run_prediction(stressed)
    return {
        "baseline": current,
        "scenario": scenario,
        "change": round((scenario["probability"] - current["probability"]) * 100, 2),
        "scenario_inputs": stressed.model_dump()
    }

@app.get("/api/analytics")
def analytics():
    bundle = get_model()
    conn = db()
    rows = conn.execute(
        "SELECT id, created_at, zone_id, probability, risk_level FROM predictions ORDER BY id DESC LIMIT 20"
    ).fetchall()
    conn.close()
    history = [dict(r) for r in rows]
    trend = list(reversed(history))
    change = 0
    if len(trend) >= 2:
        change = round((trend[-1]["probability"] - trend[0]["probability"]) * 100, 2)
    return {"metrics": bundle["metrics"], "history": history, "trend_change": change,
            "model_version": "rf-demo-v1", "data_quality": {"status": "demo", "missing_inputs": 0,
            "coverage": "Synthetic demonstration dataset"}}

@app.get("/api/impact")
def impact(zone_id: str = "ZONE-01", probability: float = 0.0):
    zone = next((z for z in load_zones()["zones"] if z["id"] == zone_id), None)
    if not zone:
        raise HTTPException(404, "Zone not found")
    risk = max(0.0, min(1.0, probability))
    assets = zone.get("assets", [])
    counts = {}
    for asset in assets:
        counts[asset["type"]] = counts.get(asset["type"], 0) + 1
    return {"zone_id": zone_id, "zone_name": zone["name"], "probability": risk,
            "risk_level": risk_level(risk), "estimated_population": int(round(850 * len(assets) * max(risk, 0.25))),
            "asset_count": len(assets), "asset_breakdown": counts, "assets": assets,
            "method": "Demo exposure estimate from included zone assets; replace with PostGIS intersections and Census data."}

@app.get("/api/brief")
def brief(zone_id: str = "ZONE-01", probability: float = 0.0, risk_level_value: str = "Low"):
    zone = next((z for z in load_zones()["zones"] if z["id"] == zone_id), None)
    if not zone:
        raise HTTPException(404, "Zone not found")
    level = risk_level_value or risk_level(probability)
    return {"title": f"{zone['name']} risk brief", "zone_id": zone_id, "risk_level": level,
            "probability": probability, "brief": (f"{zone['name']} is currently classified as {level} risk at "
            f"{round(probability * 100)}%. Monitor rainfall, soil moisture and slope conditions. "
            "This software-generated brief is based only on the current demo model output and included GIS assets."),
            "recommended_actions": recommendation(level), "generated_at": datetime.now(timezone.utc).isoformat()}

@app.get("/api/routes")
def routes(zone_id: str = "ZONE-01", probability: float = 0.0):
    zone = next((z for z in load_zones()["zones"] if z["id"] == zone_id), None)
    if not zone:
        raise HTTPException(404, "Zone not found")
    risk = max(0.0, min(1.0, probability))
    roads = [asset for asset in zone.get("assets", []) if asset.get("type") in {"Road", "Bridge"}]
    return {"zone_id": zone_id, "risk_level": risk_level(risk), "probability": risk,
            "routes": [{"name": road["name"], "type": road["type"],
                        "status": "Restrict and inspect" if risk >= 0.65 else "Monitor",
                        "reason": "Inside current elevated-risk zone" if risk >= 0.45 else "Inside monitored demo zone"}
                       for road in roads],
            "alternative_route": "Route network integration required for safe alternative calculation.",
            "method": "Demo route watch from included GIS assets; production requires PostGIS road graph and approved routing data."}

@app.get("/api/alerts")
def alerts():
    conn = db()
    rows = conn.execute(
        "SELECT id, created_at, zone_id, probability, risk_level FROM predictions WHERE probability >= 0.65 ORDER BY id DESC LIMIT 20"
    ).fetchall()
    conn.close()
    alerts = []
    for r in rows:
        action = "Immediate response coordination" if r["risk_level"] == "Critical" else "Prepare precautionary response"
        alerts.append({
            **dict(r),
            "title": f"{r['risk_level']} landslide risk detected",
            "action": action
        })
    return alerts

@app.get("/api/demo/summary")
def summary():
    zones = load_zones()
    return {
        "total_zones": len(zones["zones"]),
        "total_assets": sum(len(z.get("assets", [])) for z in zones["zones"]),
        "demo_notice": "All included GIS zones/assets are demonstration data."
    }
