import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import json
import os

def train_model(data_path='data/synthetic_historical_data.csv', model_dir='models'):
    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print(f"Error: Could not find {data_path}. Please run generate_data.py first.")
        return

    # Define features and target
    features = [
        'pm2_5', 'pm10', 'no2', 'so2', 'co', 'o3',
        'temperature', 'humidity', 'wind_speed', 'wind_direction', 'pressure',
        'day_of_week', 'month',
        'aqi_t-1', 'aqi_t-2', 'aqi_t-3',
        '7_day_avg_aqi', '14_day_avg_aqi'
    ]
    target = 'aqi_tomorrow'

    X = df[features]
    y = df[target]

    print(f"Dataset shape: {X.shape}")

    # Time-series split (using the last 20% for testing to respect temporal order)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    print(f"Training set: {len(X_train)} samples")
    print(f"Testing set: {len(X_test)} samples")

    # Initialize XGBoost Regressor
    model = xgb.XGBRegressor(
        objective='reg:squarederror',
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        random_state=42
    )

    print("Training XGBoost model...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    print("Evaluating model...")
    predictions = model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    print(f"\n--- Model Performance ---")
    print(f"RMSE: {rmse:.2f}")
    print(f"MAE:  {mae:.2f}")
    print(f"R²:   {r2:.4f}")
    print(f"-------------------------\n")

    # Save the model
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, 'aqi_xgb_model.json')
    model.save_model(model_path)
    print(f"Model saved to {model_path}")

    # Save metrics and feature list for the API to use
    metadata = {
        'features': features,
        'metrics': {
            'rmse': rmse,
            'mae': mae,
            'r2': r2
        },
        'version': 'v1.0'
    }
    
    with open(os.path.join(model_dir, 'model_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=4)
        
    print("Model metadata saved.")

if __name__ == "__main__":
    train_model()
