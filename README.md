### PostgreSQL/PostGIS and admin portal

The production database definition is in `backend/postgres_schema.sql`. It
stores regions and boundaries, historical landslides, environmental and
rainfall observations, terrain features, predictions, risk scores, alerts,
infrastructure, population estimates, users, audit logs and simulation
results. PostGIS geometry columns and GiST indexes support spatial queries.

Start the local PostGIS service:
```powershell
docker compose -f docker-compose.postgis.yml up -d
```

The current offline demo continues to use SQLite so it can run without Docker;
the admin portal labels this explicitly. Before production, point the service
layer at PostgreSQL with a secret `DATABASE_URL`, run the schema migration, and
replace demo assets with licensed regional data.

The **Admin portal** is available in the left navigation. It shows users,
roles, audit activity, prediction/alert counts, rate-limit posture and current
versus target storage. To protect it locally:
```powershell
$env:LANDSLIDEGUARD_ADMIN_KEY = "replace-with-a-long-random-value"
$env:VITE_ADMIN_KEY = "replace-with-a-long-random-value"
```
The demo seeds `admin@kavach.demo` with the `ADMIN` role and accepts the local
demo key `demo-admin-key` when no environment override is set. Production must use
hashed passwords, identity provider integration, role-based permissions and
immutable audit storage.
# LandslideGuard AI — Team KAVACH
## AI-Powered Landslide Prediction, Dynamic GIS Risk Mapping & Early Warning Platform

A locally runnable SIH-style software prototype for disaster-management demonstrations.

### What works
- React/Vite frontend
- FastAPI backend
- ML training endpoint using scikit-learn
- Persistent model artifact
- Prediction API
- What-if simulation
- Dynamic Leaflet risk map
- Explainable feature contributions
- Risk-based early-warning alerts
- Prediction history stored in SQLite
- Analytics/model metrics
- Demo historical zones/assets
- CSV training dataset included
- Health/status endpoint
- CORS, trusted-host checks, security headers, rate limiting and optional API-key authentication
- Live sensor controls with debounced model refresh
- Live GIS risk override and English/Hindi map labels
- Impact Intelligence exposure view
- Evidence-bounded disaster brief with print/PDF export
- Trend and data-quality metadata in analytics
- Infrastructure impact and emergency route review pages
- Early warning queue page backed by stored high-risk predictions
- Historical prediction register with model/data-quality metadata

### Architecture
React + Leaflet
        |
        | REST/JSON
        v
FastAPI
  |       |       |
  v       v       v
ML model SQLite  GIS/demo data
  |
  v
risk probability + explanation + warning

## Requirements
- Python 3.11 or 3.12
- Node.js 20+ LTS
- npm
- VS Code
- Internet is recommended for the OpenStreetMap basemap, but the prediction engine itself is local.

## 1. Open the project
Extract the ZIP and open `LandslideGuard_AI_KAVACH_Working` in VS Code.

## 2. Backend
Windows PowerShell:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python seed_model.py
python -m uvicorn main:app --reload --port 8000
```

If PowerShell blocks activation, use:
```powershell
.\.venv\Scripts\activate.bat
```
or simply:
```powershell
python -m pip install -r requirements.txt
python seed_model.py
python -m uvicorn main:app --reload --port 8000
```

Check:
- http://127.0.0.1:8000/api/health
- http://127.0.0.1:8000/docs

## 3. Frontend
Open a SECOND VS Code terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the URL printed by Vite, normally:
http://localhost:5173

## 4. How the frontend connects
Frontend: `http://localhost:5173`
Backend: `http://127.0.0.1:8000`

The frontend reads the API base URL from:
`frontend/.env`
```env
VITE_API_URL=http://127.0.0.1:8000
# Optional: must match the backend key when API-key authentication is enabled.
VITE_API_KEY=replace-with-a-long-random-value
```

### Backend security settings

The health endpoint remains public for frontend connectivity checks. When
`LANDSLIDEGUARD_API_KEY` is set, all other `/api/*` endpoints require the same
value in the `X-API-Key` header. The backend also applies trusted-host checks,
security response headers, and an in-memory per-client rate limit.

PowerShell example:
```powershell
$env:LANDSLIDEGUARD_API_KEY = "replace-with-a-long-random-value"
$env:LANDSLIDEGUARD_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:LANDSLIDEGUARD_ALLOWED_HOSTS = "127.0.0.1,localhost"
$env:LANDSLIDEGUARD_RATE_LIMIT = "120"
python -m uvicorn main:app --reload --port 8000
```

Use a secret manager and HTTPS termination for deployment. The in-memory rate
limiter is suitable for this single-process demo only; production deployments
should use a shared gateway or Redis-backed limiter and role-based identity.

## 5. Main demo flow
1. Open Command Center.
2. Select a demo zone.
3. Click Predict Risk.
4. Review probability, risk level and explanation.
5. Open What-if Simulator.
6. Increase rainfall and soil moisture.
7. Click Simulate.
8. Observe the risk change.
9. Open Dynamic GIS Map.
10. Review risk zones and exposed assets.
11. Open Early Warning Center to generate/review warnings.
12. Open Analytics to view model metrics and prediction history.
13. Open Impact Intelligence to review affected assets and population estimate.
14. Open Brief & Reports and print the evidence-bounded decision brief.

## SIH architecture and production path

```text
Public weather / satellite / DEM / soil / event sources
          |
        ingestion + validation
          |
    geospatial feature engineering and quality checks
          |
     model registry + calibrated prediction service
          |
    explanation + risk fusion + thresholded warning engine
          |
    PostGIS impact intersection + route intelligence
          |
      FastAPI APIs / WebSocket updates / audit events
          |
    React command center, map and decision reports
```

The current folder is a runnable demonstration slice. It uses SQLite and explicitly synthetic demo data so judges can run it offline. The production migration should replace SQLite with PostgreSQL/PostGIS, add authenticated roles, immutable audit logs, background ingestion jobs, calibrated ensemble candidates, spatial/temporal holdouts, SHAP explanations, and approved notification integrations.

### API surface

- `GET /api/health` - service, model and database readiness
- `GET /api/zones` - demo GIS regions and exposed assets
- `POST /api/predict` - validated prediction with factors and recommendation
- `POST /api/simulate` - baseline versus stressed scenario comparison
- `GET /api/impact` - exposure summary for a zone and probability
- `GET /api/brief` - evidence-bounded decision brief
- `GET /api/analytics` - metrics, history, trend and data-quality metadata
- `GET /api/alerts` - thresholded warning queue

### Blueprint implementation status

The current submission is a functional, evidence-bounded demonstration slice:

- **Functional now:** validated Random Forest prediction, contributing-factor explanation, Leaflet risk layer, what-if simulation endpoint, exposure/route views, thresholded alert queue, prediction history, analytics metadata, security middleware, and printable decision brief.
- **Clearly marked demo data:** the included CSV, zones, assets, population estimate and route result are synthetic/local demonstration inputs. The UI labels evidence quality and does not present them as official warnings.
- **Production migration required:** PostgreSQL/PostGIS spatial intersections, authenticated role-based users, immutable audit events, WebSocket ingestion, real rainfall/satellite/DEM sources, SHAP explanations, calibrated ensemble comparison, spatial/temporal validation, actual-event matching, notification integrations, and approved routing data.

The intended SIH demonstration path is: issue assessment -> inspect risk map -> open impact and route intelligence -> run a storm scenario -> review the early-warning queue -> inspect historical/model evidence -> print the evidence-bounded brief.

### Validation and data governance

The included training file is synthetic and too small to support operational claims. Its current random holdout is only a software smoke test, not a valid regional evaluation. Before deployment, use region-based spatial holdout and forward temporal validation, report PR-AUC and false-negative rate, calibrate probabilities, test missing-data behavior, and compare Logistic Regression, Random Forest, Gradient Boosting/XGBoost and neural candidates under the same splits. Keep real observations, simulated scenarios and model outputs in separate tables with source, license, timestamp and provenance metadata.

### Five-minute SIH demonstration

1. Start in Command Center and let the live signal settle.
2. Increase 24h rainfall and soil moisture; show the risk orb and factors change.
3. Open Dynamic Risk Map; show the highlighted live zone and bilingual popup.
4. Open Impact Intelligence; show exposed roads, school/settlement assets and population estimate.
5. Open What-if Simulator; compare baseline and stressed risk.
6. Open Early Warning Center; show the thresholded alert.
7. Open Brief & Reports; print the decision brief for the authority workflow.
8. Close with Analytics and explicitly state the demo-data limitation and production validation plan.

### SIH differentiation

LandslideGuard AI is positioned as end-to-end decision support rather than a probability-only model: dynamic environmental inputs, explainable factors, map-linked risk, exposure intelligence, scenario simulation, thresholded warnings, historical traceability and evidence-bounded reports. The responsible claim is measurable readiness and modular upgradeability, not universal model superiority.

## ML model
The included dataset is a small synthetic/demo training dataset designed to make the application runnable without an external data download.

The backend trains and saves a scikit-learn Random Forest classifier. The project intentionally does NOT claim that this demo model is scientifically validated for operational landslide warnings.

For an SIH final prototype, replace the demo dataset with authoritative historical landslide/environmental data and perform spatial-temporal validation, calibration, uncertainty analysis and domain validation.

## Data provenance
`data/demo_landslide_training.csv` is explicitly synthetic/demo data.
`data/demo_zones.json` contains demo GIS zones/assets.
Never present the included demo predictions as official real-world warnings.

## Troubleshooting
### `python` not recognized
Install Python and enable "Add Python to PATH", then restart VS Code.

### `npm` not recognized
Install Node.js LTS and restart VS Code.

### CORS / Failed to fetch
Make sure the backend is running on port 8000 and visit `/api/health`.

### Model not found
Run:
```powershell
cd backend
python seed_model.py
```

### Map is blank
The application uses OpenStreetMap tiles. Check internet connectivity and browser console. Prediction and analytics APIs remain local.

## Production next step
Use PostgreSQL/PostGIS, real rainfall/soil-moisture/satellite/elevation services, authenticated users, background jobs, notification providers and a validated geospatial ML model.
