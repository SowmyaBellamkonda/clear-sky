"""
Eco-Health Score service using Google Earth Engine REST API.
Fetches NDVI (vegetation density) from MODIS satellite data
and combines with AQI + weather for a composite eco-health score.
"""

import os
import json
import time
import requests
from google.oauth2 import service_account

# --- GEE Auth ---
GEE_KEY_PATH = os.path.join(os.path.dirname(__file__), "gee-key.json")
GEE_PROJECT = "clear-sky-predictor"
SCOPES = ["https://www.googleapis.com/auth/earthengine"]

_credentials = None
_ndvi_cache = {}  # key: "lat,lon" -> { ndvi, timestamp }
CACHE_TTL = 3600  # 1 hour

OWM_API_KEY = os.environ.get("OWM_API_KEY", "") or os.environ.get("VITE_OWM_API_KEY", "")


def _get_credentials():
    """Get or refresh GEE service account credentials."""
    global _credentials
    if _credentials is None or _credentials.expired:
        _credentials = service_account.Credentials.from_service_account_file(
            GEE_KEY_PATH, scopes=SCOPES
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


def fetch_ndvi(lat: float, lon: float) -> float:
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
            return cached["ndvi"]

    try:
        token = _get_access_token()
        
        # GEE REST API: compute mean NDVI for a region
        # Using MODIS/006/MOD13A2 (16-day 1km NDVI product)
        expression = {
            "expression": {
                "functionInvocationValue": {
                    "functionName": "Element.getNumber",
                    "arguments": {
                        "object": {
                            "functionInvocationValue": {
                                "functionName": "Image.reduceRegion",
                                "arguments": {
                                    "image": {
                                        "functionInvocationValue": {
                                            "functionName": "Image.multiply",
                                            "arguments": {
                                                "image1": {
                                                    "functionInvocationValue": {
                                                        "functionName": "Image.select",
                                                        "arguments": {
                                                            "input": {
                                                                "functionInvocationValue": {
                                                                    "functionName": "Collection.first",
                                                                    "arguments": {
                                                                        "collection": {
                                                                            "functionInvocationValue": {
                                                                                "functionName": "ImageCollection.sort",
                                                                                "arguments": {
                                                                                    "collection": {
                                                                                        "functionInvocationValue": {
                                                                                            "functionName": "ImageCollection.load",
                                                                                            "arguments": {
                                                                                                "id": {"constantValue": "MODIS/061/MOD13A2"}
                                                                                            }
                                                                                        }
                                                                                    },
                                                                                    "property": {"constantValue": "system:time_start"},
                                                                                    "ascending": {"constantValue": False}
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            "bandSelectors": {"constantValue": ["NDVI"]}
                                                        }
                                                    }
                                                },
                                                "image2": {"constantValue": 0.0001}
                                            }
                                        }
                                    },
                                    "reducer": {
                                        "functionInvocationValue": {
                                            "functionName": "Reducer.mean",
                                            "arguments": {}
                                        }
                                    },
                                    "geometry": {
                                        "functionInvocationValue": {
                                            "functionName": "GeometryConstructors.Point",
                                            "arguments": {
                                                "coordinates": {"constantValue": [lon, lat]}
                                            }
                                        }
                                    },
                                    "scale": {"constantValue": 1000}
                                }
                            }
                        },
                        "key": {"constantValue": "NDVI"}
                    }
                }
            }
        }

        url = f"https://earthengine.googleapis.com/v1/projects/{GEE_PROJECT}:computeValue"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        resp = requests.post(url, headers=headers, json=expression, timeout=15)
        
        if resp.status_code == 200:
            result = resp.json()
            ndvi = result.get("result", 0.0)
            if ndvi is None:
                ndvi = 0.0
            ndvi = max(-0.2, min(1.0, float(ndvi)))
        else:
            print(f"GEE API error ({resp.status_code}): {resp.text[:200]}")
            ndvi = 0.3  # Default fallback

    except Exception as e:
        print(f"Error fetching NDVI: {e}")
        ndvi = 0.3  # Fallback

    # Cache
    _ndvi_cache[cache_key] = {"ndvi": ndvi, "timestamp": now}
    return ndvi


def fetch_weather(lat: float, lon: float) -> dict:
    """Fetch temperature and humidity from OWM."""
    try:
        if not OWM_API_KEY:
            return {"temp": 25.0, "humidity": 50.0}

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&units=metric&appid={OWM_API_KEY}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        return {
            "temp": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
        }
    except Exception as e:
        print(f"Weather fetch error: {e}")
        return {"temp": 25.0, "humidity": 50.0}


def compute_eco_score(ndvi: float, aqi: int, temp: float, humidity: float) -> dict:
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
