const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const dns = require('node:dns');
const path = require('path');

// Fix for Node 17+ on Windows where IPv6 resolution fails dynamically on some ISPs (ENOTFOUND)
dns.setDefaultResultOrder('ipv4first');

// Load environment variables (look for .env in backend, or fall back to root .env)
dotenv.config(); // Local backend/.env first
if (!process.env.OPENAQ_API_KEY) {
    dotenv.config({ path: path.join(__dirname, '../.env') });
}

const connectDB = require('./db');
const apiRoutes = require('./routes/api');

// Connect to MongoDB
connectDB();

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

// Middleware
app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : undefined));
app.use(express.json());

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// see https://expressjs.com/en/guide/behind-proxies.html
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});

const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Routes
app.use('/api', apiLimiter, apiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
