const { Sequelize } = require('sequelize');
require('dotenv').config();

const database = process.env.USER_SERVICE_DB_NAME || process.env.DB_NAME || 'rideshare_db';
const username = process.env.USER_SERVICE_DB_USER || process.env.DB_USER || 'root';
const password = process.env.USER_SERVICE_DB_PASS || process.env.DB_PASS || '2702@AD';
const host = process.env.USER_SERVICE_DB_HOST || process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.USER_SERVICE_DB_PORT || process.env.DB_PORT || 3306);
const dialect = process.env.USER_SERVICE_DB_DIALECT || process.env.DB_DIALECT || 'mysql';

const sequelize = new Sequelize(database, username, password, {
host,
port,
dialect,
logging: process.env.SEQ_LOG === 'true' ? console.log : false,
define: {
  underscored: true,
  timestamps: false,
},
});

module.exports = { sequelize };