const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");
const gTTS = require("gtts");

const chat = require("../../chat");
const geminiService = require("../../../../../api/gemini/geminiService");
const instructions = require("../../models");
const extractJsonSubstringForGemini = require("../../../../../helpers/extractJsonSubstringForGemini");

let index = 0;
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
const saveTextToJson = async (text) => {
  const filePath = path.join(__dirname, "../../data", "messages.json");
  try {
    // Проверяем, существует ли файл
    let data = [];
    if (fs.existsSync(filePath)) {
      // Читаем существующий файл
      const fileContent = fs.readFileSync(filePath, "utf8");
      data = JSON.parse(fileContent);
    }

    // Добавляем новый текст в массив
    data.push({ text });

    // Сохраняем обновленный массив в файл
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log("Text saved successfully!");
  } catch (error) {
    console.error("Error saving text:", error);
  }
};

const getTextFromJson = () => {
  try {
    const filePath = path.join(__dirname, "../../data", "messages.json");
    // Проверяем, существует ли файл

    if (!fs.existsSync(filePath)) {
      console.log("File not found");
      return "";
    }

    // Читаем и парсим JSON-файл
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent);

    // Преобразуем массив объектов в одну строку
    const combinedText = data.map((item) => item.text).join(" ");

    return combinedText;
  } catch (error) {
    console.error("Error reading or processing file:", error);
    return "";
  }
};

const convertMarkdownToJson = (markdownContent, outputFilePath) => {
  if (!markdownContent || markdownContent.trim().length === 0) {
    console.error("Пустое содержимое Markdown");
    return [];
  }

  const lines = markdownContent.split("\n");
  const result = [];
  let currentItem = null;

  console.log("Начало парсинга Markdown содержимого...");

  for (let line of lines) {
    line = line.trim();

    // Пропускаем строки-заголовки (которые начинаются с # или ##)
    if (line.startsWith("#")) continue;

    // Пропускаем пустые строки
    if (!line) continue;

    // Если строка начинается с цифры и точки, это элемент списка
    if (/^\d+\.\s/.test(line)) {
      if (currentItem) {
        result.push(currentItem);
      }
      currentItem = {
        text: line.replace(/^\d+\.\s*/, ""),
        sent: false,
      };
    } else if (currentItem) {
      // Добавляем дополнительный текст к текущему элементу
      currentItem.text += " " + line;
    } else {
      result.push({ text: line, sent: false });
    }
  }

  // Добавляем последний элемент, если он существует
  if (currentItem) {
    result.push(currentItem);
  }

  // Проверяем, что результат не пустой
  if (result.length === 0) {
    console.error("Конвертированный результат пуст");
    return [];
  }

  // console.log("Парсинг завершён, результат:", result);

  // Сохраняем результат в файл
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2), "utf8");
  console.log(`JSON успешно сохранён в ${outputFilePath}`);

  return result;
};

const handleChatHistory = (
  chatId,
  {
    initUserData = "",
    userMessage = "",
    modelInstructions = [{ text: "Строго следовать указаниям/инструкциям" }],
  }
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
};

const callAPIv2 = async (
  {
    chatId,
    initUserData = "",
    userMessage = "",
    modelInstructions = [{ text: "Строго следовать указаниям/инструкциям" }],
  },
  schema
) => {
  handleChatHistory(chatId, { userMessage, modelInstructions, initUserData });

  try {
    const jsonResponse = await geminiService.generateChatTextBySchema(
      {
        userMessage,
        chatHistory: userData.chatHistory,
      },
      schema
    );

    const data = JSON.parse(jsonResponse);
    const combinedString = Object.values(data).join(" ");

    // console.log("-------------------------------");
    // console.log(11111, jsonResponse);

    userData.chatHistory[1].parts.push({ text: combinedString });

    return data;
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
// "0,20 7-21 * * *"
// '*/10 * * * * *'
cron.schedule("0,15 7-21 * * *", async () => {
  try {
    const filePath = path.join(__dirname, "../../data", "principals.json");
    const data = fs.readFileSync(filePath, "utf8");

    const updateJsonFile = (data) => {
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error("Ошибка при записи в JSON файл:", error);
      }
    };

    const jsonData = JSON.parse(data);

    if (jsonData.length === 0) {
      console.log("Нет данных для отправки.");
      return;
    }

    // Найти первое сообщение, которое еще не отправлено
    const messageToSend = jsonData.find((item) => !item.sent);

    if (messageToSend) {
      // Отправка сообщения
      await chat.sendMessage(
        process.env.MY_TELEGRAM_ID,
        `*${messageToSend.text}*`,
        {
          parse_mode: "Markdown",
        }
      );

      // Обновление статуса отправки
      messageToSend.sent = true;
      updateJsonFile(jsonData);
      console.log("Сообщение отправлено:", messageToSend.text);
    } else {
      console.log("Все сообщения отправлены. Сбрасываем статус.");

      // Если все сообщения отправлены, сбрасываем статус на false
      jsonData.forEach((item) => (item.sent = false));
      updateJsonFile(jsonData);
    }
  } catch (error) {
    console.error("Ошибка при чтении или отправке сообщений:", error);
  }
});

// "0 7-22/3 * * *"
// Find the flaws
cron.schedule("0 7-22/3 * * *", async () => {
  // once per day
  const schema = {
    type: geminiService.SchemaType.OBJECT,
    properties: {
      text: {
        description:
          "Содержание текстового ответа не должно быть длинее 4000 символов",
        type: geminiService.SchemaType.STRING,
        nullable: false,
      },
    },
    required: ["text"],
  };

  const res = await callAPIv2(
    {
      chatId: process.env.MY_TELEGRAM_ID,
      initUserData: instructions.principals,
      userMessage: instructions.flaws,
    },
    schema
  );

  if (res?.text?.length === 0) return;

  // const audioFilePath = await transformTextToAudio({
  //   text: res.text,
  //   lang: "ru",
  // });
  // chat.sendAudio(process.env.MY_TELEGRAM_ID, audioFilePath, {
  //   caption: res.text,
  //   parse_mode: "Markdown",
  // });

  chat.sendMessage(process.env.MY_TELEGRAM_ID, res.text, {
    parse_mode: "Markdown",
  });
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
  const savedMessages = getTextFromJson();
  // every one hour
  const response = await callAPIv2(
    {
      chatId: chatId,
      initUserData: `${instructions.init}\n\n${instructions.principals}\n\n${savedMessages}`,
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
                text: "Again",
                callback_data: "update",
              },
              {
                text: "Save",
                callback_data: "save",
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
        text: instructions.audio,
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
      runPrincipal(
        chatId,
        `${userMessage}\n\nВ Конце всегда задаватай user-у один вопрос который должен способствовать продолжению диалога по теме.}`
      );
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

    const userData = getUserData(chatId);
    const lastUserMessage = userData.chatHistory
      ?.filter((message) => message.role === "model")
      ?.slice(-1)?.[0]
      ?.parts?.slice(-1)?.[0]?.text;

    try {
      if (button === "update") {
        if (lastUserMessage?.length > 0) runPrincipal(chatId, lastUserMessage);
      } else if (button === "save") {
        saveTextToJson(lastUserMessage);
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
          console.log("Ссылка на файл:", fileLink);

          // Скачиваем содержимое файла
          const response = await axios.get(fileLink);
          const markdownContent = response.data;

          if (!markdownContent) {
            throw new Error("Не удалось получить содержимое Markdown файла");
          }

          // console.log("Markdown содержимое получено:", markdownContent);

          // Путь для сохранения выходного JSON файла
          const outputFilePath = path.join(
            __dirname,
            "../../data",
            "principals.json"
          );

          // Конвертируем содержимое .md файла в JSON и сохраняем
          const jsonResult = convertMarkdownToJson(
            markdownContent,
            outputFilePath
          );

          if (!jsonResult || jsonResult.length === 0) {
            throw new Error(
              "Конвертация Markdown в JSON вернула пустой результат"
            );
          }

          // Отправляем сообщение пользователю о том, что файл сохранён
          chat.sendMessage(
            chatId,
            `Ваш JSON был успешно сохранён в файл: \`${outputFilePath}\``
          );
        } catch (error) {
          console.error("Ошибка при обработке файла:", error.message);
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
