const { GoogleGenerativeAI } = require("@google/generative-ai");

const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_AI);

module.exports = genAI;
