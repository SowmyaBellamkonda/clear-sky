# ClearSky Predictor ⛅  
## AI-Driven Urban Air Quality & Eco-Health System

ClearSky Predictor is a modern, full-stack AI-powered environmental forecasting platform. It seamlessly aggregates real-time localized pollution data and integrates it with historical datasets to predict **tomorrow’s Air Quality Index (AQI)** using deep learning techniques. 

The project has recently evolved beyond a standard dashboard to incorporate conversational AI via a contextual chatbot and advanced satellite metrics to calculate a holistic **Eco-Health Score**.

---

## 🚀 Key Features & Evolution

- **Deep Learning Forecast:** Utilizes a custom-trained Long Short-Term Memory (LSTM) recurrent neural network running via Python FastAPI to provide next-day AQI prediction.
- **Accurate US EPA AQI Engine:** Dynamically calculates robust component-wise sub-indices (PM2.5, PM10, NO2, O3, SO2, CO) adhering strictly to standard US EPA breakpoint precision equations.
- **Eco-Health Score (NDVI):** Interfaces with the **Google Earth Engine (MODIS MOD13A2)** via a dedicated Python microservice to retrieve high-resolution contextual vegetation density metrics, merged mathematically with weather and pollution inputs.
- **Contextual LLaMA-3 Chatbot Assistant:** A floating AI React UI widget capable of offering succinct, location-aware environmental advice powered by the scalable `meta-llama/Meta-Llama-3-8B-Instruct` model atop a Hugging Face Serverless Inference endpoint.
- **Dynamic Glassmorphism UI:** Developed with React and Vite, the user interface natively changes aesthetic themes (gradients, map tones, overlays) contextually mapped to local AQI hazard rankings.

---

## 🏗️ System Architecture

**Frontend (React/Vite):**
- Unified Dashboard & Contextual AI Panel (`AssistantPanel.jsx`)
- Global State Management (`AQIContext.jsx`)
- Interactive Mapping System (`MapOverlay.jsx` / Leaflet)
- Responsive Glassmorphism Styling

**Backend API Proxy (Node.js/Express):**
- Aggregates live parameter streams (OpenWeatherMap)
- Handles caching and request throttling (`express-rate-limit`)
- Manages MongoDB data integration for lagging time-series sequencing
- Directly prompts the Hugging Face AI pipeline locally formatted with stateful prompt engineering

**Machine Learning Services (Python/FastAPI):**
- **LSTM Predictor (`train_lstm.py` / `app.py`):** Normalizes, scales, and propagates historical sequence inputs against trained models.
- **Eco Service (`eco_service.py`):** Caches authenticated Google Earth Engine REST API queries calculating geographic NDVI buffers natively.

---

## 🛠️ Local Development & Setup

### 1. Credentials & Environment Setup
Add your primary untracked API credentials to a `.env` file situated in the `backend/` directory:
```env
MONGO_URI="mongodb://localhost:27017/clearsky"
VITE_OWM_API_KEY="your_openweathermap_key"
HUGGINGFACE_API_KEY="your_huggingface_key"
```

You must also place a valid Google Earth Engine service account authentication key into the ML directory:
`/ml-service/gee-key.json`

### 2. Python ML Service Initialization
Open a terminal and navigate to the ML service folder:
```bash
cd ml-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
pip install tensorflow scikit-learn google-auth requests
python generate_data.py
python train_lstm.py
uvicorn app:app --host 0.0.0.0 --port 8000
```

### 3. Node.js Backend API
Open a secondary terminal:
```bash
cd backend
npm install
npm run dev
```

### 4. React Vite Frontend
Open a third terminal:
```bash
cd src
npm install
npm run dev
```

---

## 📊 ML Pipeline Details

**Time-Series Normalization:**
Features are constructed from exactly seven chronological points of day-by-day continuous intervals (incorporating weather variables and independent pollution subsets like PM2.5). These sliding windows resolve naturally into scaled dimensions fed to dense output components.

**Cold Start Management:**
The backend logic inherently mitigates local DB cold-starts via a normalized noise baseline, dynamically inserting pseudo-data iteratively prior to scaling if adequate historical entries are absent within MongoDB.

---

## 🌍 Core Endpoints

- **`GET /api/predict?lat=...&lon=...`** 
  Constructs live weather structures alongside LSTM temporal backfilling, computing internal US EPA conversion mathematics sequentially.
- **`GET /api/eco-score?lat=...&lon=...`**
  Relays requests dynamically to the Python ML server, combining API meteorological metrics logically with high-density GEE vegetative cover (NDVI).
- **`POST /api/chat`**
  Handles natural language generation requests contextually structured with location scopes returning optimized conversational replies.
