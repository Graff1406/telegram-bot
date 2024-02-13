const getMediaBasedLinks = require("./getMediaBasedLinks");

const publishAdToChannel = async ({
  chat,
  chatId,
  agentNickname,
  agentPhoneNumbers,
  message,
  pictures,
  translation,
}) => {
  let messageWithContact = message;

  if (Array.isArray(agentPhoneNumbers) && agentPhoneNumbers.length > 0) {
    messageWithContact += `\n\n*${
      translation.contactInfo.title
    }:*\n${agentPhoneNumbers.map((p) => `[${p}](tel:${p})`).join("\n")}`;
  }

  if (agentNickname) {
    messageWithContact += `\n\n[${translation.writeToTelegram.title}](https://t.me/${agentNickname})`;
  }
  try {
    // console.log(5555, messageWithContact);
    if (Array.isArray(pictures) && message) {
      const media = await getMediaBasedLinks(pictures, messageWithContact);
      return await chat.sendMediaGroup(chatId, media);
    } else if (pictures && !message) {
      const media = await getMediaBasedLinks(pictures);
      return await chat.sendMediaGroup(chatId, media);
    } else if (message) {
      return await chat.sendMessage(chatId, messageWithContact, {
        parse_mode: "Markdown",
      });
    } else {
      throw new Error(
        "You did not pass a picture or as message to publishAdOnGroup"
      );
    }
  } catch (error) {
    console.log("publishAdOnGroup: ", error);
    return null;
  }
};

module.exports = publishAdToChannel;
