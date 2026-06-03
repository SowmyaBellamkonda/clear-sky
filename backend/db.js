const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/clearsky');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        // Do not exit the process. This keeps the Express server alive to serve CORS headers
        // and allow Render health checks to pass even if the DB is temporarily unreachable.
    }
};

module.exports = connectDB;
