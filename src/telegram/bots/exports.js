const watchCRMChatGPTText = require("./crm/chatGPT/handlers/text");
const watchCRMGeminiText = require("./crm/gemini/handlers/text");
const watchSearchChatGPTText = require("./search/handlers/chatGPT/text");
const watchReminderGeminiChat = require("./reminder/handlers/gemini/text");

const watchingTelegramCRMBot = () => {
  // watchCRMChatGPTText();
  watchCRMGeminiText();
  watchSearchChatGPTText();
};

const watchingTelegramReminderBot = () => {
  watchReminderGeminiChat();
};

module.exports = { watchingTelegramCRMBot, watchingTelegramReminderBot };
