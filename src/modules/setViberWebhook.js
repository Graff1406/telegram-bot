const axios = require("axios");

const setViberWebhook = async (webhookUrl, authToken) => {
  const viberApiUrl = "https://chatapi.viber.com/pa/set_webhook";

  try {
    const res = await axios.post(viberApiUrl, {
      url: webhookUrl,
      auth_token: authToken,
    });
    // console.log("🚀 ~ setViberWebhook ~ res:", res);
  } catch (error) {
    console.error(
      "Error setting webhook:",
      error.response && error.response.data
    );
  }
};

module.exports = setViberWebhook;
