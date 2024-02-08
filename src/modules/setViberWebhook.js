const axios = require("axios");

const viberAuthToken = process.env.VIBER_CHANNEL_DENONA_SEARCH_TOKEN;

const setViberWebhook = async (webhookUrl) => {
  const viberApiUrl = "https://chatapi.viber.com/pa/set_webhook";

  try {
    const response = await axios.post(viberApiUrl, {
      url: webhookUrl,
      auth_token: viberAuthToken,
    });

    console.log("Webhook set:", response.data);
  } catch (error) {
    console.error("Error setting webhook:", error.response.data);
  }
};

module.exports = setViberWebhook;
