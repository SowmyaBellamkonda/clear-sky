import React from 'react';
import { useAQI } from '../context/AQIContext';

const GreenScorePanel = () => {
    const { ecoScore, isLoadingData } = useAQI();

    // Loading fallback
    if (isLoadingData || !ecoScore) {
        return (
            <div className="green-score-panel glass-panel">
                <div className="score-header">
                    <h3>Eco-Health Score</h3>
                </div>

                <div
                    className="score-visual"
                    style={{
                        opacity: 0.4,
                        textAlign: 'center',
                        padding: '2rem 0'
                    }}
                >
                    <p>Loading environmental data...</p>
                </div>
            </div>
        );
    }

    // =========================
    // SAFE DATA EXTRACTION
    // =========================

    const {
        score = 0,
        category = 'Unknown',
        ndvi = 0,
        temperature = 0,
        humidity = 0,
        air_quality = 0,
        recommendations = []
    } = ecoScore || {};

    // =========================
    // DERIVED SCORES
    // =========================

    const ndvi_score = ndvi;
    const aqi_score = air_quality;

    // Temperature comfort score
    let temp_score = 100;

    if (temperature > 42) {
        temp_score = 40;
    } else if (temperature > 36) {
        temp_score = 70;
    } else if (temperature < 10) {
        temp_score = 50;
    }

    // Humidity comfort score
  let humidity_score;

// Ideal humidity: 40–60%

if (humidity >= 40 && humidity <= 60) {
    humidity_score = 100;
} else if (
    (humidity >= 30 && humidity < 40) ||
    (humidity > 60 && humidity <= 70)
) {
    humidity_score = 75;
} else if (
    (humidity >= 20 && humidity < 30) ||
    (humidity > 70 && humidity <= 80)
) {
    humidity_score = 50;
} else {
    humidity_score = 25;
}

    // =========================
    // SCORE COLOR
    // =========================

    const getScoreColor = (value) => {
        if (value >= 80) return '#10b981';
        if (value >= 60) return '#34d399';
        if (value >= 40) return '#f59e0b';
        if (value >= 20) return '#f97316';
        return '#ef4444';
    };

    const scoreColor = getScoreColor(score);

    // =========================
    // NDVI DESCRIPTION
    // =========================

    const getNdviDescription = (value) => {
        if (value >= 60) return 'Dense forest / vegetation';
        if (value >= 40) return 'Moderate green cover';
        if (value >= 20) return 'Sparse vegetation';
        if (value >= 10) return 'Low vegetation / urban';
        return 'Barren / built-up';
    };

    return (
        <div className="green-score-panel glass-panel">

            {/* Header */}
            <div className="score-header">
                <h3>🌍 Eco-Health Score</h3>
            </div>

            {/* Circular Score */}
            <div className="score-visual">
                <div className="score-circle-container">

                    <svg className="score-svg" viewBox="0 0 100 100">

                        {/* Background */}
                        <circle
                            className="score-bg"
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />

                        {/* Progress */}
                        <circle
                            className="score-fill"
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke={scoreColor}
                            strokeWidth="8"
                            strokeDasharray="283"
                            strokeDashoffset={283 - (283 * score) / 100}
                            strokeLinecap="round"
                            style={{
                                transition:
                                    'stroke-dashoffset 1.5s ease-out, stroke 1.5s ease'
                            }}
                        />
                    </svg>

                    <div
                        className="score-number"
                        style={{ color: scoreColor }}
                    >
                        {score}
                    </div>
                </div>

                {/* Label */}
                <div className="score-label">
                    <span className="label-text">
                        Overall Eco-Health
                    </span>

                    <span
                        className="label-value"
                        style={{ color: scoreColor }}
                    >
                        {category}
                    </span>
                </div>
            </div>

            {/* Metrics */}
            <div className="score-metrics">

                {/* NDVI */}
                <div className="metric">

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                        }}
                    >
                        <span className="metric-text">
                            🌿 Vegetation (NDVI)
                        </span>

                        <span
                            style={{
                                fontSize: '0.7rem',
                                opacity: 0.7
                            }}
                        >
                            {ndvi.toFixed(0)}%
                        </span>
                    </div>

                    <div className="metric-bar-bg">
                        <div
                            className="metric-bar-fill"
                            style={{
                                width: `${ndvi_score}%`,
                                backgroundColor:
                                    ndvi_score >= 60
                                        ? '#10b981'
                                        : ndvi_score >= 30
                                        ? '#f59e0b'
                                        : '#ef4444'
                            }}
                        />
                    </div>

                    <span
                        style={{
                            fontSize: '0.6rem',
                            opacity: 0.5,
                            marginTop: '2px',
                            display: 'block'
                        }}
                    >
                        {getNdviDescription(ndvi)}
                    </span>
                </div>

                {/* AQI */}
                <div className="metric">

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                        }}
                    >
                        <span className="metric-text">
                            💨 Air Quality
                        </span>

                        <span
                            style={{
                                fontSize: '0.7rem',
                                opacity: 0.7
                            }}
                        >
                            {aqi_score}/100
                        </span>
                    </div>

                    <div className="metric-bar-bg">
                        <div
                            className="metric-bar-fill"
                            style={{
                                width: `${aqi_score}%`,
                                backgroundColor:
                                    aqi_score >= 70
                                        ? '#10b981'
                                        : aqi_score >= 40
                                        ? '#f59e0b'
                                        : '#ef4444'
                            }}
                        />
                    </div>
                </div>

                {/* Temperature */}
                <div className="metric">

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                        }}
                    >
                        <span className="metric-text">
                            🌡️ Temperature
                        </span>

                        <span
                            style={{
                                fontSize: '0.7rem',
                                opacity: 0.7
                            }}
                        >
                            {temperature}°C
                        </span>
                    </div>

                    <div className="metric-bar-bg">
                        <div
                            className="metric-bar-fill"
                            style={{
                                width: `${temp_score}%`,
                                backgroundColor:
                                    temp_score >= 70
                                        ? '#10b981'
                                        : '#f59e0b'
                            }}
                        />
                    </div>
                </div>

                {/* Humidity */}
                <div className="metric">

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                        }}
                    >
                        <span className="metric-text">
                            💧 Humidity
                        </span>

                        <span
                            style={{
                                fontSize: '0.7rem',
                                opacity: 0.7
                            }}
                        >
                            {humidity}%
                        </span>
                    </div>

                    <div className="metric-bar-bg">
                        <div
                            className="metric-bar-fill"
                            style={{
                                width: `${humidity_score}%`,
                                backgroundColor:
                                    humidity_score >= 70
                                        ? '#10b981'
                                        : '#f59e0b'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            <div className="panel-footer">
                <p
                    style={{
                        fontSize: '0.7rem',
                        lineHeight: '1.4'
                    }}
                >
                    {recommendations.join(', ')}
                </p>
            </div>
        </div>
    );
};

export default GreenScorePanel;