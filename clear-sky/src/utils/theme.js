import bgClean from '../assets/bg-clean.jpeg';
import bgModerate from '../assets/bg-moderate.jpeg';
import bgMixed from '../assets/bg-mixed.jpeg';
import bgSevere from '../assets/bg-severe.jpeg';

export const AQI_LEVELS = {
    CLEAN: 'clean',
    MODERATE: 'moderate',
    POOR: 'poor',
    DANGEROUS: 'dangerous'
};

export const AQI_THEMES = {
    [AQI_LEVELS.CLEAN]: {
        id: AQI_LEVELS.CLEAN,
        label: 'Good',
        range: '0 - 50',
        color: '#10b981', // Emerald
        glassTint: 'rgba(16, 185, 129, 0.15)',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        backgroundImage: bgClean,
        message: 'Air quality is considered satisfactory, and air pollution poses little or no risk.',
    },
    [AQI_LEVELS.MODERATE]: {
        id: AQI_LEVELS.MODERATE,
        label: 'Moderate',
        range: '51 - 100',
        color: '#f59e0b', // Amber
        glassTint: 'rgba(245, 158, 11, 0.15)',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        backgroundImage: bgModerate,
        message: 'Air quality is acceptable; however, there may be some health concern for sensitive individuals.',
    },
    [AQI_LEVELS.POOR]: {
        id: AQI_LEVELS.POOR,
        label: 'Unhealthy',
        range: '101 - 200',
        color: '#ef4444', // Red
        glassTint: 'rgba(239, 68, 68, 0.15)',
        glowColor: 'rgba(239, 68, 68, 0.4)',
        backgroundImage: bgMixed,
        message: 'Everyone may begin to experience health effects; sensitive groups may experience more serious effects.',
    },
    [AQI_LEVELS.DANGEROUS]: {
        id: AQI_LEVELS.DANGEROUS,
        label: 'Hazardous',
        range: '301+',
        color: '#8b5cf6', // Purple/Dark
        glassTint: 'rgba(139, 92, 246, 0.2)',
        glowColor: 'rgba(139, 92, 246, 0.5)',
        backgroundImage: bgSevere,
        message: 'Health alert: everyone may experience more serious health effects. Stay indoors.',
    }
};

export const getThemeForAQI = (value) => {
    if (value <= 50) return AQI_THEMES[AQI_LEVELS.CLEAN];
    if (value <= 100) return AQI_THEMES[AQI_LEVELS.MODERATE];
    if (value <= 300) return AQI_THEMES[AQI_LEVELS.POOR];
    return AQI_THEMES[AQI_LEVELS.DANGEROUS];
};
