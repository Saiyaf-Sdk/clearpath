const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

// Connects to MongoDB, retrying a few times (Atlas can take a moment to accept a new connection)
const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
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
