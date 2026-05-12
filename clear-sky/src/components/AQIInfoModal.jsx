import React from 'react';
import { useAQI } from '../context/AQIContext';
import GlassLayout from './GlassLayout';

const AQIInfoModal = ({ isOpen, onClose }) => {
    const { aqiValue, theme, currentComponents, mlPrediction, ecoScore } = useAQI();

    if (!isOpen) return null;

    // Calculate primary parameter (Highest concentration relative to thresholds or simply max raw value)
    // To simplify: we'll find the max AQI sub-index if we had them mapped, otherwise just list values.
    // Assuming PM2.5 and PM10 are usually the main drivers.
    const determinePrimaryPollutant = (components) => {
        if (!components) return "N/A";
        // Very basic heuristic for demo:
        let maxVal = -1;
        let primary = "Unknown";
        const keys = { 'pm2_5': 'PM2.5', 'pm10': 'PM10', 'o3': 'Ozone (O3)', 'no2': 'Nitrogen Dioxide (NO2)', 'so2': 'Sulfur Dioxide (SO2)', 'co': 'Carbon Monoxide (CO)' };
        
        // Approximate standardizations (rough factors to normalize raw ug/m3 for comparison)
        const factors = { pm2_5: 4, pm10: 2, o3: 1, no2: 1.5, so2: 1, co: 0.1 };
        
        for (const key in keys) {
            if (components[key] !== undefined) {
                const weighted = components[key] * (factors[key] || 1);
                if (weighted > maxVal) {
                    maxVal = weighted;
                    primary = keys[key];
                }
            }
        }
        return primary;
    };

    const primaryPollutant = determinePrimaryPollutant(currentComponents);
    const timestamp = new Date().toLocaleString();

    return (
        <GlassLayout className="aqi-info-popover">
            <div className="modal-header">
                <h3>Detailed Environmental Insights</h3>
                <button className="close-btn" onClick={onClose} style={{ zIndex: 10 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className="modal-scroll-area">
                {/* Timestamp & Location Stats */}
                <div className="modal-section flex-between">
                    <span style={{opacity: 0.7, fontSize: '0.9rem'}}>Generated: {timestamp}</span>
                    <div className="aqi-badge" style={{ backgroundColor: theme.color, padding: '4px 12px', fontSize: '0.8rem' }}>
                        {theme.label} ({aqiValue})
                    </div>
                </div>

                {/* Suggestions & Warnings */}
                <div className="modal-section highlight-box" style={{ borderColor: theme.color }}>
                    <h4 style={{ color: theme.color }}>Health & Activity Advice</h4>
                    {aqiValue <= 50 ? (
                        <p><strong>Perfect conditions!</strong> Open your windows to ventilate your indoor space. Great time for outdoor sports and heavy physical activities.</p>
                    ) : aqiValue <= 100 ? (
                        <p><strong>Acceptable conditions.</strong> Unusually sensitive individuals should consider reducing prolonged or heavy exertion outdoors. Otherwise, enjoy normal outdoor activities.</p>
                    ) : aqiValue <= 150 ? (
                        <p><strong>Caution.</strong> Children, active adults, and people with respiratory disease should limit prolonged outdoor exertion. Keep windows closed if you are sensitive.</p>
                    ) : (
                        <p><strong>Warning!</strong> Everyone should avoid prolonged outdoor exertion. Sensitive groups should remain indoors. Keep all windows sealed and run air purifiers if available. Wearing an N95 mask outdoors is highly recommended.</p>
                    )}
                </div>

                {/* ML Prediction */}
                <div className="modal-section">
                    <h4>🤖 Deep Learning Prediction</h4>
                    {mlPrediction ? (
                        <div className="ml-stats">
                            <div className="stat-line">
                                <span>Predicted Tomorrow:</span>
                                <span style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{mlPrediction.aqi_tomorrow} AQI</span>
                            </div>
                            <div className="stat-line">
                                <span>AI Confidence Interval:</span>
                                <span>[{mlPrediction.confidence_lower} - {mlPrediction.confidence_upper} AQI]</span>
                            </div>
                            <div className="stat-line">
                                <span>Promise/Reliability:</span>
                                <span style={{ color: (mlPrediction.confidence_upper - mlPrediction.confidence_lower) < 30 ? '#10b981' : '#f59e0b' }}>
                                    {(mlPrediction.confidence_upper - mlPrediction.confidence_lower) < 30 ? "High Confidence" : "Moderate Confidence"}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px' }}>Model Version: LSTM Temporal Sequence Evaluator</p>
                        </div>
                    ) : (
                        <p style={{ opacity: 0.6 }}>ML Prediction models are currently calculating...</p>
                    )}
                </div>

                {/* Pollutants */}
                <div className="modal-section">
                    <h4>🔬 Real-Time Pollutant Breakdown</h4>
                    <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '12px' }}>
                        Primary active pollutant causing AQI drift: <strong style={{color: '#f59e0b'}}>{primaryPollutant}</strong>
                    </p>
                    {currentComponents ? (
                        <div className="pollutant-grid">
                            <div className="p-item"><span>PM2.5</span><strong>{currentComponents.pm2_5.toFixed(1)}</strong></div>
                            <div className="p-item"><span>PM10</span><strong>{currentComponents.pm10.toFixed(1)}</strong></div>
                            <div className="p-item"><span>O3</span><strong>{currentComponents.o3?.toFixed(1) || '--'}</strong></div>
                            <div className="p-item"><span>NO2</span><strong>{currentComponents.no2?.toFixed(1) || '--'}</strong></div>
                            <div className="p-item"><span>SO2</span><strong>{currentComponents.so2?.toFixed(1) || '--'}</strong></div>
                            <div className="p-item"><span>CO</span><strong>{currentComponents.co?.toFixed(1) || '--'}</strong></div>
                            <div className="p-item"><span>NH3</span><strong>{currentComponents.nh3?.toFixed(1) || '--'}</strong></div>
                            <div className="p-item"><span>NO</span><strong>{currentComponents.no?.toFixed(1) || '--'}</strong></div>
                        </div>
                    ) : (
                        <p style={{ opacity: 0.6 }}>Fetching granular sensor data...</p>
                    )}
                </div>

                {/* Eco Score Integration */}
                <div className="modal-section">
                    <h4>🌍 Satellite Eco-Health</h4>
                    {ecoScore ? (
                        <p>
                            Current Eco-Health is categorized as <strong>{ecoScore.label}</strong> (Score: {ecoScore.eco_score}/100). 
                            This is driven by MODIS NDVI vegetative data mapped against the active air and heat metrics.
                        </p>
                    ) : (
                        <p style={{ opacity: 0.6 }}>Satellite parameters missing or compiling...</p>
                    )}
                </div>

            </div>
        </GlassLayout>
    );
};

export default AQIInfoModal;
