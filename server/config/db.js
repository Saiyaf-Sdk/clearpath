const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

// Connects to MongoDB with optimized connection pooling
const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 7000,
      minPoolSize: 2,        // Keep warm connections open to eliminate handshake delay
      maxPoolSize: 10,       // Fit safely within Atlas M0 free-tier cluster limits
      maxIdleTimeMS: 30000,  // Keep idle sockets warm
      socketTimeoutMS: 30000,
      connectTimeoutMS: 10000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected – trying to reconnect…'));
    mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  } catch (err) {
    console.error(`MongoDB connection error (attempt ${attempt}): ${err.message}`);
    if (attempt >= 5) {
      console.error('Check MONGO_URI, the database password, and that Atlas Network Access allows your IP (or 0.0.0.0/0).');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
    return connectDB(attempt + 1);
  }
  return mongoose.connection;
};

module.exports = connectDB;
