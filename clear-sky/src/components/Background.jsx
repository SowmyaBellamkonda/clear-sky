import React, { useState, useEffect } from 'react';
import { useAQI } from '../context/AQIContext';
import './Background.css';

const Background = () => {
    const { theme } = useAQI();
    const [currentImage, setCurrentImage] = useState(theme.backgroundImage);
    const [nextImage, setNextImage] = useState(null);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (theme.backgroundImage !== currentImage) {
            // Preload next image
            const img = new Image();
            img.src = theme.backgroundImage;
            img.onload = () => {
                setNextImage(theme.backgroundImage);
                setIsFading(true);

                // After transition completes, set it as current and remove next
                setTimeout(() => {
                    setCurrentImage(theme.backgroundImage);
                    setNextImage(null);
                    setIsFading(false);
                }, 1000); // 1s transition
            };
        }
    }, [theme.backgroundImage, currentImage]);

    return (
        <div className="background-container">
            <div
                className="background-layer current"
                style={{ backgroundImage: `url(${currentImage})` }}
            />
            {nextImage && (
                <div
                    className={`background-layer next ${isFading ? 'fade-in' : ''}`}
                    style={{ backgroundImage: `url(${nextImage})` }}
                />
            )}
            <div className="background-overlay" />
        </div>
    );
};

export default Background;
