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

### Prerequisites
- Node.js (v16+)
- Python 3.8+
- MongoDB (local or Atlas)
- Git

### Getting Started After Cloning the Repository

#### Step 1: Clone & Navigate
```bash
git clone https://github.com/Shyam-alt-eng/clearskyPredictor.git
cd clearskyPredictor
```

#### Step 2: Environment Variables Setup
Create a `.env` file in the `backend/` directory with your API credentials:
```env
MONGO_URI="mongodb://localhost:27017/clearsky"
OPENWEATHER_API_KEY="your_openweathermap_key"
HUGGINGFACE_API_KEY="your_huggingface_key"
ML_SERVICE_URL="http://localhost:8000"
```

For local ML service credentials, place your Google Earth Engine service account key at:
```
ml-service/gee-key.json
```

Or use environment variables (recommended for cloud):
```env
GEE_SERVICE_ACCOUNT_JSON="{...full service account json...}"
# OR base64 version
GEE_SERVICE_ACCOUNT_JSON_B64="..."
GEE_PROJECT="your-gcp-project-id"
```

#### Step 3: Install Root Dependencies (Optional)
```bash
npm install
```

#### Step 4: Start the Python ML Service (Terminal 1)
```bash
cd ml-service
python -m venv venv
.\venv\Scripts\activate          # On Windows
# source venv/bin/activate       # On macOS/Linux
pip install -r requirements.txt
pip install tensorflow scikit-learn google-auth requests
python generate_data.py
python train_lstm.py
uvicorn app:app --host 0.0.0.0 --port 8000
```
The ML service will run on `http://localhost:8000`

#### Step 5: Start the Node.js Backend API (Terminal 2)
```bash
cd backend
npm install
npm run dev
```
The backend API will run on `http://localhost:5000` (or configured port)

#### Step 6: Start the React Vite Frontend (Terminal 3)
```bash
npm install
npm run dev
```
The frontend will run on `http://localhost:5173`

### Running the Full Stack
All three services must be running simultaneously:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **ML Service:** http://localhost:8000

Open your browser and navigate to `http://localhost:5173` to access the application.

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

---

## ☁️ Deployment (Render + Vercel)

### Vercel (Frontend)
Set these environment variables:
```env
VITE_BACKEND_URL="https://your-render-backend.onrender.com"
VITE_OWM_API_KEY="your_openweathermap_key"
```

### Render (Backend)
Deploy `backend/` as a Node Web Service and set:
```env
NODE_ENV="production"
MONGO_URI="your-mongodb-uri"
OPENWEATHER_API_KEY="your_openweathermap_key"
HUGGINGFACE_API_KEY="your_huggingface_key"
ML_SERVICE_URL="https://your-render-ml-service.onrender.com"
CORS_ORIGINS="https://your-vercel-app.vercel.app"
```

### Render (ML Service)
Deploy `ml-service/` as a Python Web Service and set:
```env
OWM_API_KEY="your_openweathermap_key"
GEE_PROJECT="your-gcp-project-id"
GEE_SERVICE_ACCOUNT_JSON="{...service account json...}"
```

Start command example:
```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

### Required Google IAM for NDVI
The Google service account used for Earth Engine must have:
- Earth Engine access enabled for the account/project
- `roles/serviceusage.serviceUsageConsumer` on the configured `GEE_PROJECT`

Without this, NDVI falls back to `0.3` and the app will show fallback source metadata.
