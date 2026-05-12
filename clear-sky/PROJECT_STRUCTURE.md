# ClearSky Predictor: Architecture & Context

This document outlines the purpose and context of every file within the `clear-sky` project directory. It serves as a guide for developers to understand the project's structure, component responsibilities, and data flow.

## 📂 Root Directory

*   **`README.md`**: The main documentation file explaining the project's goals, features, and setup instructions.
*   **`package.json` / `package-lock.json`**: Defines the project's npm dependencies (React, Vite, Leaflet, etc.) and scripts.
*   **`.env`**: The actual, untracked environment variables file containing secret API keys.
*   **`vite.config.js`**: Configuration settings for the Vite build tool.
*   **`index.html`**: The main HTML entry point where the React application mounts.

---

## 📂 `src/` - Application Source

This directory contains the core logic, styles, and React components.

*   **`main.jsx`**: The React entry point. It wraps the `App` component in `React.StrictMode` and attaches it to the DOM.
*   **`App.jsx`**: The main Dashboard layout container. It initiates the browser Geolocation request, hooks into the global state, and structurally arranges all the individual UI components onto the grid.
*   **`index.css`**: The global stylesheet. It defines:
    *   CSS Variables for the design system.
    *   Responsive layouts (Flexbox/CSS Grid).
    *   The core **Glassmorphism** utilities (`.glass-panel`).
    *   Specific component overrides and Leaflet map styling adjustments.

### 📁 `src/components/` - UI Building Blocks

This folder holds all the modular React components used to build the interface.

*   **`GlassLayout.jsx`**: A foundational, reusable wrapper component. It takes any generic children and wraps them in a stylized, frosted-glass `div`.
*   **`GlassNavbar.jsx`**: The top navigation bar. Displays the application logo, the current local time, and houses the button that triggers the `MapOverlay`.
*   **`Background.jsx`**: A complex UI component responsible for rendering the high-resolution landscape photography. It listens to the `AQIContext` and executes smooth, pre-loaded cross-fade transitions when the air quality tier changes.
*   **`Background.css`**: Specific transition and overlay styles for the dynamic image layer.
*   **`AQICard.jsx`**: The prominent main widget on the dashboard. It displays the primary AQI number, qualitative text (e.g., "Good", "Hazardous"), and the glass-tinted UI elements associated with the current geographic reading.
*   **`ForecastCards.jsx`**: Maps over the prediction data array from the API, rendering a horizontal row of upcoming days and their expected air qualities.
*   **`AssistantPanel.jsx`**: A sidebar widget providing AI-simulated health recommendations, activity advice, and contextual environmental insight strings based on the severity of the current AQI.
*   **`MapOverlay.jsx`**: An interactive modal (powered by `react-leaflet`) that renders a real geographical map. It drops a custom pin on the user's detected coordinates and allows viewing other saved global locations.

### 📁 `src/context/` - Global State Management

*   **`AQIContext.jsx`**: The central nervous system of the application data. It:
    1. Holds the current `aqiValue`, `theme`, and `forecastData` in state.
    2. Exposes the `loadDataForLocation(lat, lon)` function which components call to trigger network requests.
    3. Handles the "Loading" and "Error" interface states when fetching from OpenWeatherMap.
    4. Automatically derives the proper color and image `theme` based on whatever the newly fetched AQI value is.

### 📁 `src/services/` - Data Fetching

*   **`aqiService.js`**: The service layer that communicates with the outside world.
    *   Safely retrieves the OpenWeatherMap API key from the environment.
    *   Executes `fetch` requests to OpenWeatherMap's `air_pollution` and `air_pollution/forecast` endpoints.
    *   Crucially, it normalizes and converts the raw API responses (which use a 1-5 scale) into data structures our UI components can easily consume.

### 📁 `src/utils/` - Helpers

*   **`theme.js`**: The visual configuration dictionary. It maps specific AQI threshold boundaries (Clean, Moderate, Poor, Dangerous) to exact hexadecimal colors, glass tint opacities, glow effects, text messages, and internal image asset paths. 

### 📁 `src/assets/` - Static Media

*   Stores the high-resolution JPEG background images (`bg-clean.jpeg`, `bg-moderate.jpeg`, etc.) utilized by the `Background` and `theme` systems.
