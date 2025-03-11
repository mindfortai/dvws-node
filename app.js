require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUI = require('swagger-ui-express');
const fileUpload = require('express-fileupload');
const path = require('path');

const swaggerDocument = require('./swagger'); //Swagger
const soapservice = require('./soapserver/dvwsuserservice'); //SOAP Service
const rpcserver = require('./rpc_server'); //XMLRPC Sever

const { ApolloServer } = require('apollo-server');
const {  GqSchema } =  require('./graphql/schema');

const Sequelize = require('sequelize');
const mongoose = require('mongoose');

const app = express();
const router = express.Router();

const routes = require('./routes/index.js');

app.use(express.static('public'));
app.use("/css", express.static(path.join(__dirname, "node_modules/bootstrap/dist/css")));
app.use("/js", express.static(path.join(__dirname, "node_modules/bootstrap/dist/js")));
app.use("/js", express.static(path.join(__dirname, "node_modules/jquery/dist")));
app.use("/js", express.static(path.join(__dirname, "node_modules/angular")));

app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));
app.use('/dvwsuserservice', soapservice);
app.use(bodyParser.json());
app.use(fileUpload({ parseNested: true }));

const jwt = require('jsonwebtoken')

const options = {
  expiresIn: '2d',
  issuer: 'https://github.com/snoopysecurity',
  algorithms: ["HS256", "none"],
  ignoreExpiration: true
};

var corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))
app.use('/api', routes(router));

// Add database connection function
async function connectDatabases() {
  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_LOCAL_CONN_URL, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }

  // Connect to MySQL
  const sequelize = new Sequelize(process.env.SQL_DB_NAME, process.env.SQL_USERNAME, process.env.SQL_PASSWORD, {
    host: process.env.SQL_LOCAL_CONN_URL,
    port: 57343,
    dialect: 'mysql',
    dialectOptions: {
      connectTimeout: 20000,
      ssl: {
        rejectUnauthorized: false
      }
    }
  });

  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL');
  } catch (error) {
    console.error('MySQL connection failed:', error);
    process.exit(1);
  }
}

// Modify startup sequence
async function startServers() {
  await connectDatabases();

  app.listen(process.env.EXPRESS_JS_PORT, () => {
    console.log('\n[+] Server Status:');
    console.log(`🚀 Express API listening on port ${process.env.EXPRESS_JS_PORT}`);
    console.log(`   - Local: http://localhost:${process.env.EXPRESS_JS_PORT}`);
    console.log(`   - Swagger Docs: http://localhost:${process.env.EXPRESS_JS_PORT}/api-docs`);
  });

  const server = new ApolloServer({ 
    introspection: true,
    playground: true,
    debug: true,
    allowBatchedHttpRequests: true,
    schema: GqSchema,
    context: async ({ req }) => {
         let verifiedToken = {}
          try {
           const token = req.headers.authorization.split(' ')[1]; // Bearer <token>
           verifiedToken = jwt.verify(token, process.env.JWT_SECRET, options);
          } catch (error) {
            verifiedToken = {}
          }
          return verifiedToken;
    }, });

  await server.listen({ port: process.env.GRAPHQL_PORT });
  console.log(`🚀 GraphQL Server ready at:`);
  console.log(`   - http://localhost:${process.env.GRAPHQL_PORT}/`);
  console.log(`   - GraphQL Playground: http://localhost:${process.env.GRAPHQL_PORT}/graphql`);

  console.log(`🚀 XML-RPC Server listening on port ${process.env.XML_RPC_PORT}`);
  console.log('\n[+] All services started successfully!\n');
}

// Start everything
startServers().catch(error => {
  console.error('Failed to start servers:', error);
  process.exit(1);
});

module.exports = app;
