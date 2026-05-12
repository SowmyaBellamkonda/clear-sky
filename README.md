=======
# Clear Sky 🌍

An AI-powered environmental intelligence platform for:
- Real-time AQI monitoring
- LSTM-based air quality forecasting
- Eco-health scoring
- Pollution analytics
- Weather-aware environmental insights

---

## Features

- 🌫️ Live Air Quality Monitoring
- 📈 AQI Forecasting (+3h, +6h, +12h, +24h, +48h)
- 🧠 LSTM Machine Learning Prediction
- 🌿 Dynamic Eco-Health Score
- 🗺️ Interactive Map Support
- ☁️ OpenWeather API Integration
- 📊 Pollution Breakdown Dashboard

---

## Tech Stack

### Frontend
- React
- Vite
- CSS Glassmorphism UI

### Backend
- Node.js
- Express.js
- MongoDB

### ML Service
- FastAPI
- TensorFlow / Keras
- LSTM Forecasting

---

## Project Structure

```bash
clear-sky/
│
├── frontend/
├── backend/
├── ml-service/
├── models/
└── README.md
```

---

## Installation

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
npm install
npm start
```

### ML Service

```bash
python train_lstm.py
python app.py
```

---

## Environment Variables

Create `.env` file:

```env
VITE_OWM_API_KEY=your_api_key
MONGO_URI=your_mongodb_uri
ML_SERVICE_URL=http://localhost:8000
```

---

## Screenshots

- Real-time AQI Dashboard
- Eco-Health Analytics
- Forecast Visualization

---

## Future Improvements

- Real satellite NDVI using Google Earth Engine
- Advanced transformer forecasting
- Historical trend analytics
- Mobile optimization

---

## Author

Sowmya Bellamkonda