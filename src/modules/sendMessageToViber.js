const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const viberAuthToken = process.env.VIBER_CHANNEL_DENONA_SEARCH_TOKEN;

const sendMessageToViber = async (messageData) => {
  const viberApiUrl = "https://chatapi.viber.com/pa/post";
  const body = {
    ...messageData,
    auth_token: viberAuthToken,
    from: "yoPV90tIG6+A0BJ4h8K/Kw==",
  };

  console.log("🚀 ~ sendMessageToViber ~ body:", body);
  try {
    const response = await axios.post(viberApiUrl, body);

    console.log("Message sent to Viber:", response.data);
  } catch (error) {
    console.error("Error sending message to Viber:", error);
  }
};

module.exports = sendMessageToViber;
