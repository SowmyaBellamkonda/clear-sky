import React from 'react';
import { useAQI } from '../context/AQIContext';

const GlassLayout = ({ children, className = '', style = {} }) => {
    const { theme } = useAQI();

    return (
        <div
            className={`glass-panel ${className}`}
            style={{
                backgroundColor: theme.glassTint,
                borderColor: `rgba(255, 255, 255, 0.1)`,
                boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05), 0 0 20px ${theme.glowColor}`,
                ...style
            }}
        >
            {children}
        </div>
    );
};

export default GlassLayout;
