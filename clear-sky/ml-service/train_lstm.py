import pandas as pd
import numpy as np
import os
import json
import pickle
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

def create_sequences(data, target, time_steps=7):
    X, y = [], []
    for i in range(len(data) - time_steps):
        X.append(data[i:(i + time_steps)])
        y.append(target[i + time_steps])
    return np.array(X), np.array(y)

def train_lstm_model(data_path='data/synthetic_historical_data.csv', model_dir='models'):
    print(f"Loading data from {data_path}...")
    try:
        df = pd.read_csv(data_path)
    except FileNotFoundError:
        print(f"Error: Could not find {data_path}. Please run generate_data.py first.")
        return

    # Sort to ensure temporal sequence is correct
    df = df.sort_values('date')

    # Drop the pre-calculated XGBoost lag features, use raw sequential base features
    base_features = [
        'pm2_5', 'pm10', 'no2', 'so2', 'co', 'o3',
        'temperature', 'humidity', 'wind_speed', 'wind_direction', 'pressure',
        'day_of_week', 'month', 'aqi'
    ]
    target_col = 'aqi_tomorrow'

    # Ensure target exists and no NaNs
    df = df.dropna(subset=base_features + [target_col])

    # Scale base features (LSTM is sensitive to scale)
    scaler_X = MinMaxScaler()
    scaled_features = scaler_X.fit_transform(df[base_features].values)
    
    # Target scale
    scaler_y = MinMaxScaler()
    scaled_target = scaler_y.fit_transform(df[[target_col]].values)

    time_steps = 7

    print("Creating sequential sliding windows...")
    X, y = create_sequences(scaled_features, scaled_target, time_steps)
    print(f"Sequence shape X: {X.shape}, y: {y.shape}")

    # Temporal train/test split (80/20)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print("Building LSTM model...")
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=(X_train.shape[1], X_train.shape[2])),
        Dropout(0.2),
        LSTM(32, return_sequences=False),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1)
    ])

    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    print("Training model...")
    history = model.fit(
        X_train, y_train,
        epochs=50,
        batch_size=32,
        validation_data=(X_test, y_test),
        callbacks=[early_stop],
        verbose=1
    )

    print("Evaluating model...")
    loss, mae_scaled = model.evaluate(X_test, y_test, verbose=0)
    
    # Inverse transform to get true MAE
    predictions_scaled = model.predict(X_test)
    predictions = scaler_y.inverse_transform(predictions_scaled)
    y_test_true = scaler_y.inverse_transform(y_test)
    
    mae_true = np.mean(np.abs(predictions - y_test_true))
    rmse_true = np.sqrt(np.mean(np.square(predictions - y_test_true)))
    
    print(f"\n--- Model Performance ---")
    print(f"RMSE (Original Scale): {rmse_true:.2f}")
    print(f"MAE (Original Scale):  {mae_true:.2f}")
    print(f"-------------------------\n")

    # Save models and scalers
    os.makedirs(model_dir, exist_ok=True)
    model.save(os.path.join(model_dir, 'aqi_lstm_model.h5'))
    
    with open(os.path.join(model_dir, 'scaler_X.pkl'), 'wb') as f:
        pickle.dump(scaler_X, f)
        
    with open(os.path.join(model_dir, 'scaler_y.pkl'), 'wb') as f:
        pickle.dump(scaler_y, f)

    # Save metadata
    metadata = {
        'model_type': 'lstm',
        'features': base_features,
        'time_steps': time_steps,
        'metrics': {
            'rmse': float(rmse_true),
            'mae': float(mae_true)
        },
        'version': 'v2.0'
    }
    
    with open(os.path.join(model_dir, 'model_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=4)

    print("Model, scalers, and metadata saved successfully in the 'models' directory.")

if __name__ == "__main__":
    train_lstm_model()
