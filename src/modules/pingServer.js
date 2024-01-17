const axios = require("axios");

const pingUrl = "https://telegram-bot-denona.onrender.com";

async function pingServer() {
  try {
    const response = await axios.get(pingUrl);
    console.log(`Ping successful. Status: ${response.status}`);
  } catch (error) {
    console.error(`Ping failed. Error: ${error.message}`);
  }
}

module.exports = pingServer;
