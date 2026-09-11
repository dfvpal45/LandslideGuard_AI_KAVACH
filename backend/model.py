from pathlib import Path
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = [
    "rainfall_1h", "rainfall_6h", "rainfall_24h", "rainfall_72h",
    "soil_moisture", "slope", "elevation", "historical_events",
    "temperature", "humidity"
]

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"
MODEL_PATH = MODEL_DIR / "landslide_rf.joblib"

def train_model(csv_path: str):
    df = pd.read_csv(csv_path)
    X = df[FEATURES]
    y = df["landslide"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    model = RandomForestClassifier(
        n_estimators=300, max_depth=8, min_samples_leaf=2,
        random_state=42, class_weight="balanced_subsample"
    )
    model.fit(X_train, y_train)
    calibrator = make_pipeline(
        StandardScaler(),
        LogisticRegression(
            solver="liblinear",
            max_iter=2000,
            class_weight="balanced",
            random_state=42,
        ),
    )
    calibrator.fit(X_train, y_train)
    prob = combined_probability(model, calibrator, X_test)
    pred = (prob >= 0.5).astype(int)
    roc_auc = roc_auc_score(y_test, prob) if y_test.nunique() > 1 else None

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, pred)), 4),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc), 4) if roc_auc is not None else None,
        "roc_auc_available": roc_auc is not None,
        "test_samples": int(len(y_test))
    }
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump({"model": model, "calibrator": calibrator, "features": FEATURES, "metrics": metrics}, MODEL_PATH)
    return metrics

def blended_probability(model, calibrator, rows):
    forest_probability = model.predict_proba(rows)[:, 1]
    calibrated_probability = calibrator.predict_proba(rows)[:, 1]
    return (forest_probability * 0.65) + (calibrated_probability * 0.35)

def risk_fusion_probability(rows):
    thresholds = {
        "rainfall_1h": 35, "rainfall_6h": 120, "rainfall_24h": 260,
        "rainfall_72h": 450, "soil_moisture": 75, "slope": 38,
        "historical_events": 4, "humidity": 90
    }
    weights = {
        "rainfall_1h": 0.08, "rainfall_6h": 0.10, "rainfall_24h": 0.20,
        "rainfall_72h": 0.20, "soil_moisture": 0.18, "slope": 0.14,
        "historical_events": 0.07, "humidity": 0.03
    }
    normalized = sum((rows[key] / thresholds[key]).clip(0, 1) * weights[key] for key in thresholds)
    return 1 / (1 + __import__("numpy").exp(-6 * (normalized - 0.56)))

def combined_probability(model, calibrator, rows):
    ensemble = blended_probability(model, calibrator, rows) if calibrator else model.predict_proba(rows)[:, 1]
    fusion = risk_fusion_probability(rows)
    return (ensemble * 0.55) + (fusion * 0.45)

def load_bundle():
    if not MODEL_PATH.exists():
        raise FileNotFoundError("Model artifact not found. Run seed_model.py first.")
    return joblib.load(MODEL_PATH)
