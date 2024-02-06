const openai = require("openai");

const dotenv = require("dotenv");
dotenv.config();

const openaiInstance = new openai({ key: process.env.OPENAI_API_KEY });

module.exports = openaiInstance;
