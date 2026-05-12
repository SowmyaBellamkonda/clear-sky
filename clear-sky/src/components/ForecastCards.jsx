import React from 'react';
import GlassLayout from './GlassLayout';
import { useAQI } from '../context/AQIContext';

const getMiniAqiColor = (aqi) => {
    if (aqi == null) return '#94a3b8';
    if (aqi <= 50) return '#10b981';
    if (aqi <= 100) return '#f59e0b';
    if (aqi <= 200) return '#ef4444';
    return '#8b5cf6';
};

const ForecastCards = () => {
    const { forecastIntervals, isLoadingData } = useAQI();

    if (isLoadingData || !forecastIntervals) {
        return (
            <div className="forecast-container" style={{ opacity: 0.5 }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <GlassLayout key={i} className="forecast-card flex-col-center">
                        <span className="forecast-day">...</span>
                        <span className="forecast-icon">☁️</span>
                        <div className="forecast-aqi">-- AQI</div>
                    </GlassLayout>
                ))}
            </div>
        );
    }

    return (
        <div className="forecast-container">
            {forecastIntervals.map((item, index) => {
                const isAI = item.source === 'lstm';
                const cardStyle = isAI
                    ? {
                        border: '1px solid rgba(139, 92, 246, 0.5)',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(255, 255, 255, 0.05))',
                    }
                    : {};

                return (
                    <GlassLayout
                        key={index}
                        className={`forecast-card flex-col-center ${isAI ? 'ai-forecast-card' : ''}`}
                        style={cardStyle}
                    >
                        <span className="forecast-day">{item.label}</span>
                        <span className="forecast-icon">
                            {item.icon}
                        </span>
                        <div
                            className="forecast-aqi"
                            style={{
                                color: getMiniAqiColor(item.aqi),
                                fontWeight: isAI ? 'bold' : 'normal',
                            }}
                        >
                            {item.aqi != null ? `${item.aqi} AQI` : '-- AQI'}
                        </div>
                        {isAI && item.confidence && (
                            <div
                                className="forecast-confidence"
                                style={{
                                    fontSize: '0.6rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    marginTop: '2px',
                                }}
                            >
                                ±{item.confidence[1] - item.aqi}
                            </div>
                        )}
                    </GlassLayout>
                );
            })}
        </div>
    );
};

export default ForecastCards;
