const getMessageToMe = ({ chat, message, name, photo }) => {
  if (!!photo) {
    chat.sendPhoto(process.env.MY_TELEGRAM_ID, { caption: message });
  } else {
    chat.sendMessage(
      process.env.MY_TELEGRAM_ID,
      `User: ${name}\n\nMessage: ${message}`
    );
  }
};

module.exports = getMessageToMe;
