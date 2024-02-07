const watchCRMChatGPTText = require("./crm/chatGPT/handlers/text");
const watchSearchChatGPTText = require("./search/handlers/chatGPT/text");
const watchReminderGeminiChat = require("./reminder/handlers/gemini/text");

const watchingTelegramCRMBot = () => {
  watchCRMChatGPTText();
  watchSearchChatGPTText();
};

const watchingTelegramReminderBot = () => {
  watchReminderGeminiChat();
};

module.exports = { watchingTelegramCRMBot, watchingTelegramReminderBot };
