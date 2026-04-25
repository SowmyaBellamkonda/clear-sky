"""
Eco-Health Score service using Google Earth Engine REST API.
Fetches NDVI (vegetation density) from MODIS satellite data
and combines with AQI + weather for a composite eco-health score.
"""

import os
import json
import base64
import time
import requests
from google.oauth2 import service_account

try:
    import ee
except Exception:
    ee = None

# --- GEE Auth ---
GEE_KEY_PATH = os.environ.get("GEE_KEY_PATH", os.path.join(os.path.dirname(__file__), "gee-key.json"))
GEE_PROJECT = "clear-sky-predictor"
SCOPES = ["https://www.googleapis.com/auth/earthengine"]

_credentials = None
_service_account_info = None
_ndvi_cache = {}  # key: "lat,lon" -> { ndvi, source, timestamp }
CACHE_TTL = 3600  # 1 hour

OWM_API_KEY = os.environ.get("OWM_API_KEY", "") or os.environ.get("VITE_OWM_API_KEY", "")


def _get_service_account_info() -> dict:
    """Resolve service account credentials from env vars or local key file."""
    global _service_account_info
    if _service_account_info is not None:
        return _service_account_info

    raw_json = os.environ.get("GEE_SERVICE_ACCOUNT_JSON")
    raw_json_b64 = os.environ.get("GEE_SERVICE_ACCOUNT_JSON_B64")

    if raw_json:
        _service_account_info = json.loads(raw_json)
        return _service_account_info

    if raw_json_b64:
        decoded = base64.b64decode(raw_json_b64).decode("utf-8")
        _service_account_info = json.loads(decoded)
        return _service_account_info

    with open(GEE_KEY_PATH, "r", encoding="utf-8") as key_file:
        _service_account_info = json.load(key_file)
        return _service_account_info


def _get_credentials():
    """Get or refresh GEE service account credentials."""
    global _credentials
    if _credentials is None or _credentials.expired:
        _credentials = service_account.Credentials.from_service_account_info(
            _get_service_account_info(), scopes=SCOPES
        )
        from google.auth.transport.requests import Request
        _credentials.refresh(Request())
    return _credentials


def _get_access_token():
    """Get a valid access token for GEE API calls."""
    creds = _get_credentials()
    if not creds.valid:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    return creds.token


def _get_gee_project_candidates() -> list[str]:
    """Resolve candidate GEE projects in priority order."""
    candidates = []

    env_project = os.environ.get("GEE_PROJECT")
    if env_project:
        candidates.append(env_project)

    try:
        key_data = _get_service_account_info()
        if key_data.get("project_id"):
            candidates.append(key_data["project_id"])
    except Exception:
        pass

    candidates.append(GEE_PROJECT)

    unique_candidates = []
    for project in candidates:
        if project and project not in unique_candidates:
            unique_candidates.append(project)
    return unique_candidates


def fetch_ndvi(lat: float, lon: float) -> dict:
    """
    Fetch mean NDVI for a ~10km area around (lat, lon) using
    MODIS MOD13A2 (16-day 1km NDVI) via the GEE REST API.
    Returns a value between -0.2 (water/bare) and 1.0 (dense vegetation).
    """
    cache_key = f"{round(lat, 2)},{round(lon, 2)}"
    now = time.time()
    
    # Check cache
    if cache_key in _ndvi_cache:
        cached = _ndvi_cache[cache_key]
        if now - cached["timestamp"] < CACHE_TTL:
            return {
                "ndvi": cached["ndvi"],
                "source": cached.get("source", "cached"),
                "error": cached.get("error"),
            }

    try:
        if ee is None:
            raise RuntimeError("earthengine-api not installed")

        creds = _get_credentials()
        last_error = None
        ndvi_value = None
        selected_project = None

        for project in _get_gee_project_candidates():
            try:
                ee.Initialize(credentials=creds, project=project)

                point = ee.Geometry.Point([lon, lat])
                latest_modis = (
                    ee.ImageCollection("MODIS/061/MOD13A2")
                    .sort("system:time_start", False)
                    .first()
                    .select("NDVI")
                    .multiply(0.0001)
                )

                ndvi_value = latest_modis.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=point,
                    scale=1000,
                ).get("NDVI").getInfo()
                selected_project = project
                break
            except Exception as candidate_error:
                last_error = candidate_error

        if ndvi_value is None and last_error is not None:
            raise last_error

        if ndvi_value is None:
            ndvi_value = 0.0

        ndvi = max(-0.2, min(1.0, float(ndvi_value)))
        source = f"google-earth-engine-sdk:{selected_project}" if selected_project else "google-earth-engine-sdk"
        error_message = None
    except Exception as e:
        error_message = str(e)
        print(f"Error fetching NDVI: {error_message}")
        ndvi = 0.3  # Fallback
        source = "fallback:error"

    # Cache
    _ndvi_cache[cache_key] = {
        "ndvi": ndvi,
        "source": source,
        "error": error_message,
        "timestamp": now,
    }
    return {"ndvi": ndvi, "source": source, "error": error_message}


def fetch_weather(lat: float, lon: float, temp: float | None = None, humidity: float | None = None) -> dict:
    """Fetch temperature and humidity from OWM, unless live values are already provided."""
    try:
        if temp is not None and humidity is not None:
            return {"temp": float(temp), "humidity": float(humidity), "source": "backend-live"}

        if not OWM_API_KEY:
            return {"temp": 25.0, "humidity": 50.0, "source": "fallback:no-api-key"}

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        return {
            "temp": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "source": "openweathermap",
        }
    except Exception as e:
        print(f"Weather fetch error: {e}")
        return {
            "temp": float(temp) if temp is not None else 25.0,
            "humidity": float(humidity) if humidity is not None else 50.0,
            "source": "fallback:error" if temp is None or humidity is None else "backend-live-fallback",
        }


def compute_eco_score(ndvi: float, aqi: int, temp: float, humidity: float, sources: dict | None = None) -> dict:
    """
    Compute the composite Eco-Health Score (0-100).
    
    Weights:
    - NDVI (40%): 0.0 = 0 score, 0.7+ = full score
    - AQI  (35%): 0 AQI = full, 500+ = 0
    - Temp (15%): Ideal 15-30°C
    - Humidity (10%): Ideal 40-70%
    """
    # NDVI score (0-100): scale 0.0-0.7 to 0-100
    ndvi_score = max(0, min(100, (ndvi / 0.7) * 100))

    # AQI score (0-100): inverse mapping
    aqi_score = max(0, min(100, ((500 - aqi) / 500) * 100))

    # Temperature score: peaks at 22°C, drops off
    if 15 <= temp <= 30:
        temp_score = 100
    elif temp < 15:
        temp_score = max(0, 100 - (15 - temp) * 5)
    else:
        temp_score = max(0, 100 - (temp - 30) * 5)

    # Humidity score: ideal 40-70%
    if 40 <= humidity <= 70:
        humidity_score = 100
    elif humidity < 40:
        humidity_score = max(0, 100 - (40 - humidity) * 3)
    else:
        humidity_score = max(0, 100 - (humidity - 70) * 3)

    # Weighted composite
    eco_score = int(
        ndvi_score * 0.40 +
        aqi_score * 0.35 +
        temp_score * 0.15 +
        humidity_score * 0.10
    )
    eco_score = max(0, min(100, eco_score))

    # Label
    if eco_score >= 80:
        label = "Thriving"
        recommendation = "Rich vegetation and clean air. Ideal for outdoor activities."
    elif eco_score >= 60:
        label = "Healthy"
        recommendation = "Good green cover and acceptable air quality. Enjoy the outdoors."
    elif eco_score >= 40:
        label = "Moderate"
        recommendation = "Some environmental stress. Limit strenuous outdoor activity."
    elif eco_score >= 20:
        label = "Degraded"
        recommendation = "Low vegetation and/or poor air quality. Stay indoors if sensitive."
    else:
        label = "Critical"
        recommendation = "Severe environmental degradation. Avoid outdoor exposure."

    return {
        "eco_score": eco_score,
        "label": label,
        "recommendation": recommendation,
        "sources": sources or {},
        "breakdown": {
            "ndvi": round(ndvi, 3),
            "ndvi_score": round(ndvi_score, 1),
            "aqi_score": round(aqi_score, 1),
            "temp": round(temp, 1),
            "temp_score": round(temp_score, 1),
            "humidity": round(humidity, 1),
            "humidity_score": round(humidity_score, 1),
        }
    }
