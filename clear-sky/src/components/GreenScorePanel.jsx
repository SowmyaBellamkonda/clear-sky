import React from 'react';
import { useAQI } from '../context/AQIContext';

const GreenScorePanel = () => {
    const { ecoScore, isLoadingData } = useAQI();

    // Fallback while loading
    if (isLoadingData || !ecoScore) {
        return (
            <div className="green-score-panel glass-panel">
                <div className="score-header">
                    <h3>Eco-Health Score</h3>
                    <div className="info-icon" title="Composite environmental health index using satellite vegetation data (NDVI), air quality, temperature, and humidity.">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                </div>
                <div className="score-visual" style={{ opacity: 0.4, textAlign: 'center', padding: '2rem 0' }}>
                    <p>Loading satellite data...</p>
                </div>
            </div>
        );
    }

    const { eco_score, label, recommendation, breakdown } = ecoScore;
    const { ndvi, ndvi_score, aqi_score, temp, temp_score, humidity, humidity_score } = breakdown;

    // Color based on score
    const getScoreColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#34d399';
        if (score >= 40) return '#f59e0b';
        if (score >= 20) return '#f97316';
        return '#ef4444';
    };

    const scoreColor = getScoreColor(eco_score);

    // NDVI to text description
    const getNdviDescription = (ndvi) => {
        if (ndvi >= 0.6) return 'Dense forest / vegetation';
        if (ndvi >= 0.4) return 'Moderate green cover';
        if (ndvi >= 0.2) return 'Sparse vegetation';
        if (ndvi >= 0.1) return 'Low vegetation / urban';
        return 'Barren / water / built-up';
    };

    return (
        <div className="green-score-panel glass-panel">
            <div className="score-header">
                <h3>🌍 Eco-Health Score</h3>

            </div>

            <div className="score-visual">
                <div className="score-circle-container">
                    <svg className="score-svg" viewBox="0 0 100 100">
                        <circle
                            className="score-bg"
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        <circle
                            className="score-fill"
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke={scoreColor}
                            strokeWidth="8"
                            strokeDasharray="283"
                            strokeDashoffset={283 - (283 * eco_score) / 100}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1.5s ease-out, stroke 1.5s ease' }}
                        />
                    </svg>
                    <div className="score-number" style={{ color: scoreColor }}>
                        {eco_score}
                    </div>
                </div>

                <div className="score-label">
                    <span className="label-text">Overall Eco-Health</span>
                    <span className="label-value" style={{ color: scoreColor }}>
                        {label}
                    </span>
                </div>
            </div>

            {/* Breakdown metrics */}
            <div className="score-metrics">
                {/* Vegetation (NDVI) */}
                <div className="metric">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="metric-text">🌿 Vegetation (NDVI)</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{(ndvi * 100).toFixed(0)}%</span>
                    </div>
                    <div className="metric-bar-bg">
                        <div className="metric-bar-fill" style={{ width: `${ndvi_score}%`, backgroundColor: ndvi >= 0.4 ? '#10b981' : ndvi >= 0.2 ? '#f59e0b' : '#ef4444' }}></div>
                    </div>
                    <span style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '2px', display: 'block' }}>{getNdviDescription(ndvi)}</span>
                </div>

                {/* Air Quality */}
                <div className="metric">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="metric-text">💨 Air Quality</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{aqi_score.toFixed(0)}/100</span>
                    </div>
                    <div className="metric-bar-bg">
                        <div className="metric-bar-fill" style={{ width: `${aqi_score}%`, backgroundColor: aqi_score >= 70 ? '#10b981' : aqi_score >= 40 ? '#f59e0b' : '#ef4444' }}></div>
                    </div>
                </div>

                {/* Temperature */}
                <div className="metric">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="metric-text">🌡️ Temperature</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{temp}°C</span>
                    </div>
                    <div className="metric-bar-bg">
                        <div className="metric-bar-fill" style={{ width: `${temp_score}%`, backgroundColor: temp_score >= 70 ? '#10b981' : '#f59e0b' }}></div>
                    </div>
                </div>

                {/* Humidity */}
                <div className="metric">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="metric-text">💧 Humidity</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{humidity}%</span>
                    </div>
                    <div className="metric-bar-bg">
                        <div className="metric-bar-fill" style={{ width: `${humidity_score}%`, backgroundColor: humidity_score >= 70 ? '#10b981' : '#f59e0b' }}></div>
                    </div>
                </div>
            </div>

            <div className="panel-footer">
                <p style={{ fontSize: '0.7rem', lineHeight: '1.4' }}>{recommendation}</p>

            </div>
        </div>
    );
};

export default GreenScorePanel;
