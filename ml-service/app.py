from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, conlist
import numpy as np
import pandas as pd
import json
import os
import pickle

app = FastAPI(title="ClearSky ML Service", description="AI-Driven temporal AQI Forecasting API (LSTM)")

# --- Globals ---
MODEL_PATH = "models/lstm_weights.pkl"
META_PATH = "models/model_metadata.json"
SCALER_X_PATH = "models/scaler_X.pkl"
SCALER_Y_PATH = "models/scaler_y.pkl"

model_weights = None
metadata = None
scaler_X = None
scaler_y = None

# --- NumPy LSTM Helper ---
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def lstm_forward(x_seq, kernel, recurrent_kernel, bias, return_sequences=True):
    time_steps, input_dim = x_seq.shape
    units = recurrent_kernel.shape[0]
    
    W_i, W_f, W_c, W_o = np.split(kernel, 4, axis=-1)
    U_i, U_f, U_c, U_o = np.split(recurrent_kernel, 4, axis=-1)
    b_i, b_f, b_c, b_o = np.split(bias, 4, axis=-1)
    
    h = np.zeros(units)
    c = np.zeros(units)
    
    h_seq = []
    
    for t in range(time_steps):
        xt = x_seq[t]
        i_t = sigmoid(np.dot(xt, W_i) + np.dot(h, U_i) + b_i)
        f_t = sigmoid(np.dot(xt, W_f) + np.dot(h, U_f) + b_f)
        c_tilde = np.tanh(np.dot(xt, W_c) + np.dot(h, U_c) + b_c)
        c = f_t * c + i_t * c_tilde
        o_t = sigmoid(np.dot(xt, W_o) + np.dot(h, U_o) + b_o)
        h = o_t * np.tanh(c)
        h_seq.append(h)
        
    if return_sequences:
        return np.array(h_seq)
    else:
        return h

def predict_numpy(X_input, weights):
    x = X_input[0]
    x = lstm_forward(x, 
                     weights['lstm_kernel'], 
                     weights['lstm_recurrent_kernel'], 
                     weights['lstm_bias'], 
                     return_sequences=True)
    x = lstm_forward(x, 
                     weights['lstm_1_kernel'], 
                     weights['lstm_1_recurrent_kernel'], 
                     weights['lstm_1_bias'], 
                     return_sequences=False)
    x = np.dot(x, weights['dense_kernel']) + weights['dense_bias']
    x = np.maximum(0, x)
    x = np.dot(x, weights['dense_1_kernel']) + weights['dense_1_bias']
    return x[0]

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
    history: list[DailyFeatures]

class PredictionOutput(BaseModel):
    predicted_aqi: int
    confidence_interval: list[int]
    model_version: str
    rmse: float

# --- Startup Event ---
@app.on_event("startup")
async def load_model():
    global model_weights, metadata, scaler_X, scaler_y
    
    if not os.path.exists(MODEL_PATH) or not os.path.exists(META_PATH):
        print(f"Warning: Model files not found.")
        return
        
    try:
        with open(MODEL_PATH, 'rb') as f:
            model_weights = pickle.load(f)
            
        with open(META_PATH, 'r') as f:
            metadata = json.load(f)
            
        with open(SCALER_X_PATH, 'rb') as f:
            scaler_X = pickle.load(f)
            
        with open(SCALER_Y_PATH, 'rb') as f:
            scaler_y = pickle.load(f)
            
        print("NumPy LSTM weights and scalers loaded successfully.")
    except Exception as e:
        print(f"Error loading model: {e}")

# --- Endpoints ---
@app.get("/")
def read_root():
    return {"status": "ClearSky LSTM Service is running"}

@app.post("/predict", response_model=PredictionOutput)
def predict_aqi(payload: PredictInput):
    if model_weights is None or metadata is None or scaler_X is None or scaler_y is None:
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
        
        sequence_data = []
        for day in payload.history:
            day_dict = day.dict()
            row = [day_dict[feat] for feat in feature_order]
            sequence_data.append(row)
            
        sequence_array = np.array(sequence_data)
        
        # Scale the features
        scaled_sequence = scaler_X.transform(sequence_array)
        
        # Reshape to (1, time_steps, features)
        X_input = scaled_sequence.reshape(1, time_steps_required, len(feature_order))
        
        # Predict using NumPy
        predicted_scaled = predict_numpy(X_input, model_weights)
        
        # Inverse transform to get true AQI
        predicted_true = scaler_y.inverse_transform([[predicted_scaled]])[0][0]
        
        rmse = metadata['metrics']['rmse']
        
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
def get_eco_score(lat: float, lon: float, aqi: int = 50, temp: float | None = None, humidity: float | None = None):
    """Get the Eco-Health Score for a location using GEE satellite NDVI data."""
    try:
        from eco_service import fetch_ndvi, fetch_weather, compute_eco_score

        ndvi_result = fetch_ndvi(lat, lon)
        weather = fetch_weather(lat, lon, temp=temp, humidity=humidity)
        result = compute_eco_score(
            ndvi_result["ndvi"],
            aqi,
            weather["temp"],
            weather["humidity"],
            sources={
                "ndvi": ndvi_result.get("source", "unknown"),
                "ndvi_error": ndvi_result.get("error"),
                "weather": weather.get("source", "unknown"),
                "aqi": "openweathermap-air-pollution",
            },
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eco-score error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
