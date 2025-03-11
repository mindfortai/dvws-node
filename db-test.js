require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SQL_DB_NAME, process.env.SQL_USERNAME, process.env.SQL_PASSWORD, {
  host: process.env.SQL_LOCAL_CONN_URL,
  port: 57343,
  dialect: 'mysql',
  dialectOptions: {
    connectTimeout: 60000,
    ssl: {
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection successful!');
    
    // Test query
    const result = await sequelize.query('SELECT 1+1 as result');
    console.log('Query result:', result);
    
    // Test connection info
    const [rows] = await sequelize.query('SELECT @@wait_timeout, @@interactive_timeout');
    console.log('MySQL timeouts:', rows[0]);
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await sequelize.close();
  }
}

testConnection(); 