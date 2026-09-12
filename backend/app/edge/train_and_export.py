import json
import math
import os
from typing import Any, Dict, List

import numpy as np
from sklearn.ensemble import IsolationForest

from app.edge.features import FEATURE_NAMES, extract_features

# Mathematical average path length of unsuccessful search in Binary Search Tree
def c_factor(n: int) -> float:
    if n <= 1:
        return 1.0
    if n == 2:
        return 1.0
    euler_mascheroni = 0.57721566490153286
    return 2.0 * (math.log(n - 1.0) + euler_mascheroni) - (2.0 * (n - 1.0) / float(n))


def serialize_tree(tree, max_samples: int) -> Dict[str, Any]:
    """Converts a sklearn DecisionTree (from IsolationForest) into a portable dict."""
    n_nodes = tree.node_count
    children_left = tree.children_left
    children_right = tree.children_right
    feature = tree.feature
    threshold = tree.threshold
    n_node_samples = tree.n_node_samples

    nodes = []
    for i in range(n_nodes):
        is_leaf = bool(children_left[i] == -1 and children_right[i] == -1)
        nodes.append({
            "id": i,
            "feature": int(feature[i]),
            "threshold": round(float(threshold[i]), 5) if not is_leaf else None,
            "left": int(children_left[i]),
            "right": int(children_right[i]),
            "is_leaf": is_leaf,
            "samples": int(n_node_samples[i]),
        })

    return {
        "node_count": int(n_nodes),
        "nodes": nodes,
    }


def generate_training_data(n_samples: int = 1500) -> np.ndarray:
    """Generates synthetic multi-feature observations matching mining distributions."""
    rng = np.random.RandomState(42)
    X = []

    # Nominal safe operations (80% of data)
    n_nominal = int(n_samples * 0.82)
    for _ in range(n_nominal):
        cat = rng.choice(["safety", "environment", "labour"], p=[0.5, 0.3, 0.2])
        desc_samples = [
            "Routine shift inspection completed without incident.",
            "Water discharge within standard pH and turbidity limits.",
            "PPE adherence verified across contract crew.",
            "Conveyor belt rollers greased and aligned.",
            "Haul road surface watered for particulate dust suppression.",
        ]
        obs = {
            "category": cat,
            "description": rng.choice(desc_samples),
            "zone_risk_baseline": rng.uniform(0.15, 0.45),
            "inspector_historical_high_rate": rng.uniform(0.05, 0.25),
            "days_since_last_zone_inspection": rng.randint(1, 14),
            "has_photo": rng.choice([0, 1], p=[0.4, 0.6]),
        }
        vec, _ = extract_features(obs)
        X.append(vec)

    # Anomaly / high-risk operations (18% of data)
    n_anomalous = n_samples - n_nominal
    for _ in range(n_anomalous):
        cat = rng.choice(["safety", "environment", "labour"], p=[0.65, 0.25, 0.1])
        desc_samples = [
            "Severe spalling and crack widening observed on gallery roof support.",
            "Methane sensor triggered intermittent threshold warning in underground gallery.",
            "Heavy slurry runoff overflowing settling pond embankment towards seasonal nallah.",
            "High concentration of airborne coal dust with inadequate water curtain pressure.",
            "Uncertified machinery operator found maneuvering heavy excavator near bench edge.",
        ]
        obs = {
            "category": cat,
            "description": rng.choice(desc_samples),
            "zone_risk_baseline": rng.uniform(0.65, 0.95),
            "inspector_historical_high_rate": rng.uniform(0.4, 0.8),
            "days_since_last_zone_inspection": rng.randint(18, 30),
            "has_photo": rng.choice([0, 1], p=[0.1, 0.9]),
        }
        vec, _ = extract_features(obs)
        X.append(vec)

    return np.array(X, dtype=np.float32)


def train_and_export_model():
    print("Generating training dataset...")
    X_train = generate_training_data(1500)
    print(f"X_train shape: {X_train.shape}")

    n_estimators = 50
    max_samples = 128
    contamination = 0.18

    print("Training IsolationForest model...")
    clf = IsolationForest(
        n_estimators=n_estimators,
        max_samples=max_samples,
        contamination=contamination,
        random_state=42,
    )
    clf.fit(X_train)

    c_n = c_factor(max_samples)

    serialized_trees = [
        serialize_tree(est.tree_, max_samples) for est in clf.estimators_
    ]

    model_export = {
        "model_type": "IsolationForest",
        "version": "1.0.0",
        "feature_names": FEATURE_NAMES,
        "n_features": len(FEATURE_NAMES),
        "n_estimators": n_estimators,
        "max_samples": max_samples,
        "c_factor": round(c_n, 6),
        "thresholds": {
            "high": 0.62,
            "medium": 0.48,
        },
        "trees": serialized_trees,
    }

    # Save to backend
    backend_out = os.path.join(os.path.dirname(__file__), "model_weights.json")
    with open(backend_out, "w") as f:
        json.dump(model_export, f)
    print(f"Saved backend model weights to: {backend_out}")

    # Save to mobile/assets/model/model.json
    mobile_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../mobile/assets/model"))
    os.makedirs(mobile_dir, exist_ok=True)
    mobile_out = os.path.join(mobile_dir, "model.json")
    with open(mobile_out, "w") as f:
        json.dump(model_export, f)
    print(f"Saved mobile model weights to: {mobile_out}")

    return model_export


if __name__ == "__main__":
    train_and_export_model()
