import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_synthetic_data(num_days=365*2, start_date='2024-01-01'):
    """
    Generates synthetic daily weather and pollution data mimicking a typical city
    to train an AQI prediction model.
    """
    print(f"Generating {num_days} days of synthetic data starting from {start_date}...")
    np.random.seed(42)  # For reproducibility
    
    dates = pd.date_range(start=start_date, periods=num_days, freq='D')
    
    # Base seasonal pattern (sin wave with 365-day period)
    # Higher in summer, lower in winter
    day_of_year = dates.dayofyear
    seasonal_temp = 20 + 10 * np.sin(2 * np.pi * (day_of_year - 100) / 365)
    
    # Weather features
    temperature = seasonal_temp + np.random.normal(0, 3, num_days)
    humidity = np.clip(60 - 0.5 * temperature + np.random.normal(0, 10, num_days), 20, 100)
    wind_speed = np.clip(np.random.lognormal(mean=1.5, sigma=0.5, size=num_days), 0, 15)
    wind_direction = np.random.randint(0, 360, num_days)
    pressure = np.random.normal(1013, 5, num_days)

    # Pollution features
    # Higher temp/lower wind generally increases ozone
    o3 = np.clip(20 + 0.8 * temperature - 1.5 * wind_speed + np.random.normal(0, 5, num_days), 0, 150)
    
    # Lower temp/lower wind increases PM2.5 and PM10 (winter inversions)
    pm2_5_base = 15 - 0.5 * temperature - 2 * wind_speed
    pm2_5 = np.clip(pm2_5_base + np.random.lognormal(mean=1.5, sigma=0.8, size=num_days), 1, 300)
    pm10 = np.clip(pm2_5 * 1.5 + np.random.normal(10, 5, num_days), 5, 400)
    
    # Traffic related (higher on weekdays)
    is_weekend = dates.dayofweek >= 5
    traffic_factor = np.where(is_weekend, 0.7, 1.0)
    no2 = np.clip((10 + np.random.normal(5, 3, num_days)) * traffic_factor, 1, 100)
    so2 = np.clip(np.random.lognormal(mean=1.0, sigma=0.5, size=num_days), 0, 50)
    co = np.clip((200 + np.random.normal(50, 20, num_days)) * traffic_factor, 100, 2000)

    # Calculate AQI (simplified approximation based on max pollutant)
    # In reality, AQI uses piecewise linear breakpoints for each pollutant
    # We create a correlated arbitrary 'AQI' feature for training purposes
    aqi_simulated = (
        (pm2_5 * 1.8) +
        (pm10 * 0.8) +
        (o3 * 0.5) +
        (no2 * 0.5) +
        np.random.normal(0, 10, num_days)
    ).astype(int)
    
    aqi_simulated = np.clip(aqi_simulated, 10, 500)

    df = pd.DataFrame({
        'date': dates,
        'pm2_5': pm2_5,
        'pm10': pm10,
        'no2': no2,
        'so2': so2,
        'co': co,
        'o3': o3,
        'temperature': temperature,
        'humidity': humidity,
        'wind_speed': wind_speed,
        'wind_direction': wind_direction,
        'pressure': pressure,
        'aqi': aqi_simulated
    })
    
    # Time features
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    
    # Lag and Rolling features
    df = df.sort_values('date')
    df['aqi_t-1'] = df['aqi'].shift(1)
    df['aqi_t-2'] = df['aqi'].shift(2)
    df['aqi_t-3'] = df['aqi'].shift(3)
    df['7_day_avg_aqi'] = df['aqi'].rolling(window=7).mean()
    df['14_day_avg_aqi'] = df['aqi'].rolling(window=14).mean()
    
    # Target feature: Tomorrow's AQI
    df['aqi_tomorrow'] = df['aqi'].shift(-1)
    
    # Drop rows with NaN values resulting from shifts/rolling
    df = df.dropna()

    print(f"Generated {len(df)} rows of data.")
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    
    csv_path = 'data/synthetic_historical_data.csv'
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")

if __name__ == "__main__":
    generate_synthetic_data(num_days=1000) # ~2.7 years of daily data
