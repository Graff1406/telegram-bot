const getMediaBasedLinks = require("./getMediaBasedLinks");

const publishAdToChannel = async ({
  chat,
  chatId,
  agentNickname,
  message,
  pictures,
  translation,
}) => {
  const messageWithContact = `${message}\n\n<a href="https://t.me/${agentNickname}"><b>${translation.contactInfo.title}</b></a>`;
  try {
    console.log(5555, messageWithContact);
    if (Array.isArray(pictures) && message) {
      const media = await getMediaBasedLinks(pictures, messageWithContact);
      return await chat.sendMediaGroup(chatId, media);
    } else if (pictures && !message) {
      const media = await getMediaBasedLinks(pictures);
      return await chat.sendMediaGroup(chatId, media);
    } else if (message) {
      await chat.sendMessage(chatId, messageWithContact, {
        parse_mode: "HTML",
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
