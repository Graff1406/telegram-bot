const axios = require("axios");

const pingServer = async (pingUrl) => {
  try {
    const response = await axios.get(pingUrl);
    console.log(`Ping successful. Status: ${response.status}`);

    setTimeout(() => pingServer(pingUrl), 60000);
  } catch (error) {
    console.error(`Ping failed Error(pingServer). Status: ${error.status}`);
    setTimeout(() => pingServer(pingUrl), 60000);
  }
};

module.exports = pingServer;
