const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");
const gTTS = require("gtts");

const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../models");
const extractJsonSubstringForGemini = require("../../../../../helpers/extractJsonSubstringForGemini");

let data = {};
const USER_DATA_TIMEOUT = 14 * 24 * 60 * 60 * 1000; // 14 days
const menu = {
  values: "/values",
  english: "/english",
};

const setInitData = (payload = {}) => {
  return {
    chatHistory: [],
    currentPage: menu.values, //menu.values,
  };
};

const clearInactiveUserData = () => {
  const currentTime = Date.now();
  for (const chatId in data) {
    const userData = data[chatId];
    if (currentTime - userData.lastInteractionTime > USER_DATA_TIMEOUT) {
      delete data[chatId];
    }
  }
};

setInterval(clearInactiveUserData, USER_DATA_TIMEOUT);

const updateLastInteractionTime = (chatId) => {
  if (data[chatId]) {
    data[chatId].lastInteractionTime = Date.now();
  }
};

const getUserData = (chatId) => {
  if (!data[chatId]) {
    data[chatId] = setInitData();
  }
  return data[chatId];
};

const callAPI = async ({ chatId, userMessage, customInstructions }) => {
  const userData = getUserData(chatId);

  if (!userMessage) {
    userData.chatHistory = userData.chatHistory.filter(
      (_, i, arr) => i !== arr.length - 1
    );
    userData.chatHistory.push({
      role: "model",
      parts: "",
    });
  } else {
    userData.chatHistory.push(
      {
        role: "user",
        parts: userMessage,
      },
      {
        role: "model",
        parts: "",
      }
    );
  }

  try {
    const res = await geminiService.generateChatText({
      userMessage: userMessage,
      instructions: customInstructions,
      chatHistory: userData.chatHistory,
    });

    console.log("-------------------------------");
    console.log(11111, res);
    const data = extractJsonSubstringForGemini(res);
    console.log(222222, data);

    userData.chatHistory[userData.chatHistory.length - 1].parts = data;

    return data;
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return null;
  }
};

const callAPIv2 = async (
  {
    chatId,
    initUserData = "",
    userMessage = "",
    modelInstructions = [{ text: "" }],
  },
  schema
) => {
  const userData = getUserData(chatId);

  if (
    Array.isArray(userData.chatHistory) &&
    userData.chatHistory.length === 0
  ) {
    userData.chatHistory = [
      {
        role: "user",
        parts: [{ text: initUserData }],
      },
      {
        role: "model",
        parts: modelInstructions,
      },
    ];
  }

  if (
    userMessage?.trim() &&
    Array.isArray(userData.chatHistory) &&
    userData.chatHistory[0]?.role === "user"
  ) {
    userData.chatHistory[0].parts.push({ text: userMessage });
  }

  try {
    const jsonResponse = await geminiService.generateChatTextBySchema(
      {
        userMessage,
        chatHistory: userData.chatHistory,
      },
      schema
    );

    // console.log("-------------------------------");
    // console.log(11111, jsonResponse);

    userData.chatHistory[1].parts.push({ text: jsonResponse });

    return JSON.parse(jsonResponse);
  } catch (error) {
    console.log("🚀 ~ error:", error);
    return null;
  }
};

const transformTextToAudio = async ({ text, filePath, lang = "en" }) => {
  const gtts = new gTTS(text, lang);

  const audioFilePath =
    filePath ?? path.join(__dirname, "..", "..", "data", "audio.mp3");

  return new Promise((resolve, reject) => {
    gtts.save(audioFilePath, (err) => {
      if (err) {
        console.error("Ошибка при сохранении аудио:", err);
        reject(err);
      } else {
        console.log(`Аудио сохранено по пути: ${audioFilePath}`);
        resolve(audioFilePath);
      }
    });
  });
};

// Random principal
// "0,30 7-21 * * *"
// '*/10 * * * * *'
cron.schedule("0,20 7-21 * * *", async () => {
  const schema = {
    type: geminiService.SchemaType.OBJECT,
    properties: {
      quote: {
        description:
          "Цитата, принцип, утверждение, ценность отвечать в полном ее объеме, то есть целиком без зжатии.",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
      detail: {
        description:
          "Лаконичное разяснение смыслов цитаты чтобы понять глубину цитаты. Не должно повторять твой ответ из поля quote",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
    },
    required: ["quote", "detail"],
  };
  // every one hour
  const res = await callAPIv2(
    {
      chatId: process.env.MY_TELEGRAM_ID,
      initUserData: instructions.principals,
      userMessage: instructions.notification,
    },
    schema
  );

  // Шаг 4: Парсинг и проверка ответа
  if (!res) {
    throw new Error("Empty response from AI model");
  }

  // Шаг 5: Преобразование массива в объект

  if (res.quote) {
    // const audioFilePath = await transformTextToAudio({
    //   text: `${res.quote}\n\n${res.detail}`,
    //   lang: "ru",
    // });

    // chat.sendAudio(process.env.MY_TELEGRAM_ID, audioFilePath, {
    //   caption: `*${res.quote}*\n\n_${res.detail}_`,
    //   parse_mode: "Markdown",
    // });

    chat.sendMessage(
      process.env.MY_TELEGRAM_ID,
      `*${res.quote}*\n\n${res.detail}`,
      {
        parse_mode: "Markdown",
      }
    );
  }
});

// Find the flaws
cron.schedule("30 14 * * *", async () => {
  // once per day
  const schema = {
    type: geminiService.SchemaType.OBJECT,
    properties: {
      response: {
        description: "Твой ответ должен содержать максимум 5000 символов",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
    },
    required: ["response"],
  };

  const res = await callAPIv2(
    {
      chatId: process.env.MY_TELEGRAM_ID,
      initUserData: instructions.principals,
      userMessage: instructions.flaws,
    },
    schema
  );

  if (!res.response) return;

  // const audioFilePath = await transformTextToAudio({
  //   text: res.response,
  //   lang: "ru",
  // });
  // chat.sendAudio(process.env.MY_TELEGRAM_ID, audioFilePath, {
  //   caption: extractJsonSubstringForGemini(res.response),
  //   parse_mode: "Markdown",
  // });

  chat.sendMessage(
    process.env.MY_TELEGRAM_ID,
    extractJsonSubstringForGemini(res.response),
    {
      parse_mode: "Markdown",
    }
  );
});

const runPrincipal = async (chatId, userMessage) => {
  const schema = {
    type: geminiService.SchemaType.OBJECT,
    properties: {
      data: {
        description: "Твой граммотрый ответ на запрос пользователя",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
    },
    required: ["data"],
  };
  // every one hour
  const response = await callAPIv2(
    {
      chatId: chatId,
      initUserData: `${instructions.init}\n\n${instructions.principals}`,
      userMessage,
    },
    schema
  );

  try {
    if (response.data?.length > 500) {
      chat.sendMessage(chatId, response.data, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Update",
                callback_data: "update",
              },
            ],
          ],
        },
      });
    } else {
      chat.sendMessage(chatId, response.data, {
        parse_mode: "Markdown",
      });
    }
  } catch (e) {
    chat.sendMessage(chatId, response.data);
  }
};

const runEnglish = async (chatId, userMessage) => {
  const schema = {
    type: geminiService.SchemaType.OBJECT,
    properties: {
      data: {
        description: "Простые и понятные ответы от учителя английского языка",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
    },
    required: ["data"],
  };
  // every one hour
  const response = await callAPIv2(
    {
      chatId: chatId,
      initUserData: instructions.english,
      userMessage,
    },
    schema
  );

  const audioFilePath = await transformTextToAudio({
    text: response.data,
  });

  chat.sendAudio(process.env.MY_TELEGRAM_ID, audioFilePath, {
    caption: response.data,
    parse_mode: "Markdown",
  });
};

const getVoiceMessageAsBase64 = async (fileId) => {
  try {
    // Получаем прямую ссылку на файл через Telegram API
    const fileUrl = await chat.getFileLink(fileId);

    // Скачиваем файл по ссылке и преобразуем его в Base64
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const base64AudioFile = Buffer.from(response.data, "binary").toString(
      "base64"
    );
    return base64AudioFile;
  } catch (error) {
    console.error("Error converting voice message to Base64:", error.message);
    throw new Error("Failed to get voice message as Base64");
  }
};

const getContentByAudio = async (fileId, schema) => {
  try {
    // Шаг 1: Получаем аудиофайл в формате Base64
    const base64AudioFile = await getVoiceMessageAsBase64(fileId);

    // Шаг 3: Генерация контента на основе аудио и текста
    const res = await geminiService.generateContentByAudio(
      {
        text: `
        Пожалуйста, прослушай предоставленный аудиофайл и выполни следующие задачи:

Понимание содержания: Определи основной смысл сказанного в аудио и кратко перескажи его на английском языке.

Произношение и дикция: Обрати внимание на произношение. Если в речи присутствуют ошибки или недостатки в дикции, укажи на них и подробно объясни, какие именно проблемы были замечены (например, неправильное произношение слов, ошибки в ударениях или интонациях). Предложи рекомендации по улучшению произношения.

Коррекция текста: Если в аудио присутствуют грамматические или лексические ошибки, представь корректный вариант сказанного на английском языке.

Ответ на содержание: На основе содержания аудио, предоставь релевантный и вежливый ответ на английском языке. Заверши свой ответ вопросом по теме, чтобы поддержать диалог.

        `,
        base64AudioFile,
      },
      schema
    );

    // Шаг 4: Парсинг и проверка ответа
    if (!res) {
      throw new Error("Empty response from AI model");
    }

    const data = JSON.parse(res);

    return {
      success: true,
      data,
    };
  } catch (error) {
    // Логирование ошибок и возврат корректного ответа
    console.error("Error in getAIResponse:", error.message);
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
    };
  }
};

module.exports = () => {
  chat.on("text", (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;
    const userData = getUserData(chatId);

    updateLastInteractionTime(chatId);

    const menus = Object.values(menu);

    if (menus.includes(userMessage)) return;

    if (userData.currentPage === menu.english) {
      runEnglish(chatId, userMessage);
    } else {
      runPrincipal(chatId, userMessage);
    }

    // chat.setMyCommands([
    //   {
    //     command: "/values",
    //     description: "Ценности",
    //   },
    //   {
    //     command: "/english",
    //     description: "English",
    //   },
    // ]);
  });

  chat.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const button = query.data;

    try {
      if (button === "update") {
        callAPI({ chatId });
      }
    } catch (error) {
      console.log("🚀 ~ chat.on ~ error:", error);
    }
  });

  chat.onText(/\/values/, (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);
    userData.currentPage = menu.values;
    chat.sendMessage(chatId, "Вкл. Ценности");
    return;
  });

  chat.onText(/\/english/, (msg) => {
    const chatId = msg.chat.id;
    const userData = getUserData(chatId);
    userData.currentPage = menu.english;
    chat.sendMessage(chatId, "Вкл. English");
    return;
  });

  chat.on("document", async (msg) => {
    const chatId = msg.chat.id;

    // Проверка, есть ли в сообщении документ
    if (msg.document) {
      const fileName = msg.document.file_name;
      const fileExtension = path.extname(fileName);

      // Проверяем, является ли файл .md
      if (fileExtension === ".md") {
        try {
          // Получаем file_id
          const fileId = msg.document.file_id;

          // Получаем ссылку на файл
          const fileLink = await chat.getFileLink(fileId);

          // Скачиваем и сохраняем файл
          const response = await axios.get(fileLink, {
            responseType: "stream",
          });
          const writer = fs.createWriteStream(
            path.join(__dirname, "../../data", "principals.md")
          );

          response.data.pipe(writer);

          // Дожидаемся завершения записи файла
          writer.on("finish", () => {
            chat.sendMessage(chatId, "Файл успешно сохранен как principals.md");
          });
          writer.on("error", (err) => {
            console.error("Ошибка при сохранении файла:", err);
            chat.sendMessage(chatId, "Ошибка при сохранении файла.");
          });
        } catch (error) {
          console.error("Ошибка при обработке файла:", error);
          chat.sendMessage(chatId, "Ошибка при обработке файла.");
        }
      } else {
        // Отправляем сообщение о неправильном формате файла
        chat.sendMessage(
          chatId,
          "Пожалуйста, отправьте файл с расширением .md"
        );
      }
    }
  });

  chat.on("voice", async (msg) => {
    const chatId = msg.chat.id;
    const fileId = msg.voice.file_id;

    const schema = {
      type: geminiService.SchemaType.OBJECT,
      properties: {
        original: {
          description:
            "Текст, расшифрованный из аудио, на оригинальном языке, без изменений и исправлений. Вернуть в исходном виде без обработки.",
          type: geminiService.SchemaType.STRING,
          nullable: false,
        },
        corrected: {
          description:
            "Исправленный и грамматически корректный вариант текста на английском языке, если в оригинале были ошибки. Если исправления не требуются, оставить текст без изменений.",
          type: geminiService.SchemaType.STRING,
        },
        explanation: {
          description:
            "Подробное объяснение на русском языке, какие именно грамматические или лексические ошибки были исправлены в предложении. Указать, какие слова или конструкции были изменены и почему.",
          type: geminiService.SchemaType.STRING,
        },
        response: {
          description:
            "Ответ на содержание аудио на английском языке, учитывая контекст сказанного. Ответ должен быть релевантным, включать рекомендации или разъяснения по теме и заканчиваться вопросом, связанным с содержанием.",
          type: geminiService.SchemaType.STRING,
          nullable: false,
        },
        responseRu: {
          description: "Перевод содержимого поля response на русском.",
          type: geminiService.SchemaType.STRING,
          nullable: false,
        },
      },
      required: ["original", "corrected", "explanation", "response"],
    };

    const res = await getContentByAudio(fileId, schema);

    if (res.success) {
      console.log("Voice", res);

      const { corrected, explanation, original, response, responseRu } =
        res.data;

      if (corrected !== original) {
        const message = `*Corrected*\n${corrected}\n\n*Original*\n${original}\n\n*Explanation*\n${explanation}`;

        await chat.sendMessage(chatId, message, {
          parse_mode: "Markdown",
        });
      }

      const audioFilePath = await transformTextToAudio({
        text: response,
      });
      chat.sendAudio(process.env.MY_TELEGRAM_ID, audioFilePath, {
        caption: `*${response}*\n\n_${responseRu}_`,
        parse_mode: "Markdown",
      });
    }
  });
};
