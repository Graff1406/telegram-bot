const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const sendMessageToViber = async (
  messageData,
  translation,
  authToken,
  memberID
) => {
  if (!authToken) throw new Error("Did not passed Viber Auth Token");

  const data = messageData;
  const viberApiUrl = "https://chatapi.viber.com/pa/post";

  if (
    Array.isArray(messageData.agentPhoneNumbers) &&
    messageData.agentPhoneNumbers.length > 0
  ) {
    data.text += `\n\n*${
      translation.contactInfo.title
    }:*\n${messageData.agentPhoneNumbers.join("\n")}`;
  }

  if (messageData.agentNickname) {
    data.text += `\nTelegram: ${messageData.agentNickname}`;
  }

  if (messageData.agentFirstName) {
    data.text += `\n${messageData.agentFirstName}`;
  }

  const body = {
    ...data,
    auth_token: authToken,
    from: memberID,
  };

  // console.log("🚀 ~ sendMessageToViber ~ body:", body);
  try {
    // const response = await axios.post(viberApiUrl, body);
    // console.log("🚀 ~ sendMessageToViber ~ response:", response);
    await axios.post(viberApiUrl, body);

    // console.log("Message sent to Viber:", response.data);
  } catch (error) {
    console.error("Error sending message to Viber:", error);
  }
};

module.exports = sendMessageToViber;
