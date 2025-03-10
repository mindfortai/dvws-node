const Sequelize = require('sequelize');
require('dotenv').config();

const mongoose = require('mongoose');

const User = require('./models/users');


const connHost = process.env.SQL_LOCAL_CONN_URL;
const connUser = process.env.SQL_USERNAME;
const connPass = process.env.SQL_PASSWORD;
const connUri = process.env.MONGO_LOCAL_CONN_URL;

// Add retry mechanism for database connection
async function connectWithRetry(maxAttempts = 5, delay = 5000) {
  console.log('[+] Environment variables:');
  console.log(`Host: ${connHost}`);
  console.log(`Username: ${connUser}`);
  console.log(`Password length: ${connPass?.length}`);
  
  const sequelize = new Sequelize('dvws_sqldb', connUser, connPass, {
    host: connHost,
    port: 57343, // Updated Railway MySQL port
    dialect: 'mysql',
    logging: console.log,
    dialectOptions: {
      connectTimeout: 20000, // Increase timeout to 20 seconds
      ssl: {
        rejectUnauthorized: false // Add SSL option for Railway
      }
    },
    retry: {
      max: 3 // Add connection retry at Sequelize level
    }
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[+] Attempting to connect to MySQL (attempt ${attempt}/${maxAttempts})...`);
      await sequelize.authenticate();
      console.log('[+] Successfully connected to MySQL');
      return sequelize;
    } catch (error) {
      console.error(`[!] Connection error details:`, {
        message: error.message,
        code: error.original?.code,
        errno: error.original?.errno,
        syscall: error.original?.syscall
      });
      
      if (attempt === maxAttempts) {
        throw error;
      }
      console.log(`[!] Connection attempt ${attempt} failed, retrying in ${delay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Main initialization function
async function initialize() {
  try {
    const sequelize = await connectWithRetry();
    
    console.log('[+] Creating MySQL database for DVWS....');
    await sequelize.query("DROP DATABASE IF EXISTS dvws_sqldb;");
    console.log("[+] Old SQL Database deleted");
    await sequelize.query("CREATE DATABASE dvws_sqldb;");
    console.log("[+] SQL Database created");
    await sequelize.close();
    await createAdmin();
  } catch (err) {
    console.error('Failed to initialize:', err);
    process.exit(1);
  }
}

// Modified to use async/await
async function createAdmin() {
  try {
    await mongoose.connect(connUri, { useNewUrlParser: true, useUnifiedTopology: true });
    
    const user = new User({
      username: "admin",
      password: "letmein",
      admin: true
    });

    const user2 = new User({
      username: "test",
      password: "test",
      admin: false
    });

    await user.save();
    console.log('Admin user created:', user);
    await user2.save();
    console.log('Test user created:', user2);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creating users:', error);
    throw error;
  }
}

// Start the initialization process
initialize();

