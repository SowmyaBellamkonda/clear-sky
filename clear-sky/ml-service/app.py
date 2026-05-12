from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, conlist
import numpy as np
import pandas as pd
import json
import os
import pickle

app = FastAPI(title="ClearSky ML Service", description="AI-Driven temporal AQI Forecasting API (LSTM)")

# --- Globals ---
MODEL_PATH = "models/aqi_lstm_model.h5"
META_PATH = "models/model_metadata.json"
SCALER_X_PATH = "models/scaler_X.pkl"
SCALER_Y_PATH = "models/scaler_y.pkl"

model = None
metadata = None
scaler_X = None
scaler_y = None

# --- Data Models ---
class DailyFeatures(BaseModel):
    pm2_5: float
    pm10: float
    no2: float
    so2: float
    co: float
    o3: float
    temperature: float
    humidity: float
    wind_speed: float
    wind_direction: float
    pressure: float
    day_of_week: int
    month: int
    aqi: float

class PredictInput(BaseModel):
    # Expect a sequence of historical days (e.g., last 7 days)
    history: list[DailyFeatures]

class PredictionOutput(BaseModel):
    predicted_aqi: int
    confidence_interval: list[int]
    model_version: str
    rmse: float

# --- Startup Event ---
@app.on_event("startup")
async def load_model():
    global model, metadata, scaler_X, scaler_y
    import tensorflow as tf
    
    if not os.path.exists(MODEL_PATH) or not os.path.exists(META_PATH):
        print(f"Warning: Model files not found.")
        return
        
    try:
        model = tf.keras.models.load_model(MODEL_PATH, compile=False)
        
        with open(META_PATH, 'r') as f:
            metadata = json.load(f)
            
        with open(SCALER_X_PATH, 'rb') as f:
            scaler_X = pickle.load(f)
            
        with open(SCALER_Y_PATH, 'rb') as f:
            scaler_y = pickle.load(f)
            
        print("LSTM Model and scalers loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")

# --- Endpoints ---
@app.get("/")
def read_root():
    return {"status": "ClearSky LSTM Service is running"}

@app.post("/predict", response_model=PredictionOutput)
def predict_aqi(payload: PredictInput):
    if model is None or metadata is None or scaler_X is None or scaler_y is None:
        raise HTTPException(status_code=503, detail="Model not initialized. Please train the model.")
        
    time_steps_required = metadata.get('time_steps', 7)
    
    if len(payload.history) != time_steps_required:
        raise HTTPException(
            status_code=400, 
            detail=f"Expected {time_steps_required} historical time steps, got {len(payload.history)}."
        )
        
    try:
        # Construct feature array strictly following the 'base_features' order
        feature_order = metadata.get('features')
        
        # Convert Pydantic list of dicts to a flat list of lists
        sequence_data = []
        for day in payload.history:
            day_dict = day.dict()
            # Ensure the order matches training
            row = [day_dict[feat] for feat in feature_order]
            sequence_data.append(row)
            
        # Shape: (7, features)
        sequence_array = np.array(sequence_data)
        
        # Scale the features
        scaled_sequence = scaler_X.transform(sequence_array)
        
        # Reshape to (1, time_steps, features) for the LSTM
        X_input = scaled_sequence.reshape(1, time_steps_required, len(feature_order))
        
        # Predict
        predicted_scaled = model.predict(X_input, verbose=0)
        
        # Inverse transform to get true AQI
        predicted_true = scaler_y.inverse_transform(predicted_scaled)[0][0]
        
        rmse = metadata['metrics']['rmse']
        
        # Calculate naive 95% confidence interval
        lower_bound = max(0, int(predicted_true - (1.96 * rmse)))
        upper_bound = int(predicted_true + (1.96 * rmse))
        
        return {
            "predicted_aqi": int(predicted_true),
            "confidence_interval": [lower_bound, upper_bound],
            "model_version": metadata.get('version', 'lstm-v2.0'),
            "rmse": round(rmse, 2)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

# --- Eco-Health Score Endpoint ---
@app.get("/eco-score")
def get_eco_score(lat: float, lon: float, aqi: int = 50):
    """Get the Eco-Health Score for a location using GEE satellite NDVI data."""
    try:
        from eco_service import fetch_ndvi, fetch_weather, compute_eco_score

        ndvi = fetch_ndvi(lat, lon)
        weather = fetch_weather(lat, lon)
        result = compute_eco_score(ndvi, aqi, weather["temp"], weather["humidity"])

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eco-score error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
