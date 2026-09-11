# LandslideGuard AI: SIH Production Blueprint

## Implemented demonstration slice

The current runnable system includes a FastAPI prediction service, persisted SQLite prediction history, Random Forest demo artifact, live debounced sensor predictions, Leaflet/CARTO GIS view, bilingual English/Hindi map labels, explainable factor contributions, scenario simulation, thresholded alerts, analytics, impact intelligence, and printable decision briefs.

## Target production architecture

```text
Weather, IMD, satellite, DEM, soil, land-cover, event and OSM sources
  -> scheduled ingestion jobs
  -> validation, provenance and missing-data checks
  -> PostGIS feature store and spatial joins
  -> versioned feature pipeline
  -> candidate model registry and calibrated ensemble
  -> prediction, explanation and threshold services
  -> WebSocket/API gateway
  -> map, alerts, impact, route and reporting clients
```

## PostGIS schema proposal

- `regions(id, name, district, state, geom geometry(MultiPolygon,4326))`
- `observations(id, observed_at, source, rainfall_1h, rainfall_6h, rainfall_24h, rainfall_72h, soil_moisture, temperature, humidity, geom)`
- `terrain_features(region_id, elevation, slope, aspect, curvature, drainage_density, ndvi, land_cover)`
- `landslide_events(id, event_at, source, severity, geom, verified)`
- `infrastructure(id, type, name, criticality, geom geometry(Geometry,4326))`
- `predictions(id, region_id, observed_at, probability, risk_level, confidence, model_version, payload jsonb)`
- `alerts(id, prediction_id, severity, status, acknowledged_by, created_at, resolved_at, action jsonb)`
- `simulation_runs(id, user_id, inputs jsonb, outputs jsonb, created_at)`
- `users(id, role, name, email, password_hash, active, created_at)`
- `audit_logs(id, user_id, action, resource, metadata jsonb, created_at)`

Use GiST indexes on all geometry columns and time indexes on observations, events and predictions. Impact queries should use `ST_Intersects` and `ST_DWithin` against the current risk geometry.

## Model evaluation gate

Do not use the current random split as evidence of regional performance. A production gate should run region-based spatial holdout plus forward temporal validation. Compare Logistic Regression, Random Forest, Gradient Boosting/XGBoost and a neural candidate using identical folds. Report recall, precision, F1, ROC-AUC, PR-AUC, confusion matrix, calibration error and false-negative rate. Select using a documented utility that penalizes missed high-risk events, while checking calibration and interpretability.

## Explainability

For tree models, add SHAP TreeExplainer values beside the existing transparent factor heuristic. Persist the feature snapshot, model version and explanation with each prediction so an authority can audit why a warning was generated.

## Security and reliability backlog

- OAuth2/OIDC authentication and RBAC for ADMIN, DISASTER_AUTHORITY, ANALYST and VIEWER.
- Pydantic validation at every write boundary, rate limiting, structured errors and request IDs.
- Immutable audit events for predictions, threshold changes, acknowledgements and exports.
- Background workers for ingestion and notification retries.
- WebSocket updates backed by a message broker.
- PostgreSQL backups, health probes, metrics, logs and alerting.

## Docker migration outline

The deployable production stack should contain `frontend`, `api`, `worker`, `postgres-postgis`, `redis` and a reverse proxy. Keep the current local SQLite mode for offline judging, then switch through environment variables and migrations. Never ship the synthetic model as an operational warning model.

## Responsible claims

The included CSV and GIS zones are explicitly synthetic demonstration data. The current metrics prove that the software path works, not that landslide prediction is accurate in the North Eastern Region. Replace demo data with licensed authoritative observations, validate geographically and temporally, calibrate thresholds with disaster-management experts, and obtain operational approval before issuing public warnings.
