const watchCRMChatGPTText = require("./crm/chatGPT/handlers/text");
const watchSearchChatGPTText = require("./search/handlers/chatGPT/text");

const watchingTelegramCRMBot = () => {
  watchCRMChatGPTText();
  watchSearchChatGPTText();
};

module.exports = { watchingTelegramCRMBot };
