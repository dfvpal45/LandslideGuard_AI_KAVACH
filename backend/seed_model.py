from pathlib import Path
from model import train_model

base = Path(__file__).resolve().parent.parent
csv_path = base / "data" / "demo_landslide_training.csv"
metrics = train_model(str(csv_path))
print("Model trained successfully.")
print(metrics)
