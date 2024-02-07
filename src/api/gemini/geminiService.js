const genAI = require("./config");
const { processImage } = require("../../helpers/imageProcessor");

const extractJsonSubstring = require("../../helpers/extractJsonSubstring");

async function generateText(prompt, temperature = 0.9) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const result = await model.generateContent(prompt, { temperature });
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (err) {
    console.error(err);
    return "";
  }
}

async function generateChatText({
  userMessage = "",
  chatHistory = [],
  temperature = 0.5,
}) {
  const model = genAI.getGenerativeModel({
    model: "gemini-pro",
    generationConfig: { temperature },
  });
  try {
    const chat = await model.startChat({
      history: [
        {
          role: "user",
          parts: "",
        },
        {
          role: "model",
          parts: `
            Получите вводные данные от пользователя, предположительно в форме вопроса по определенной теме.
            Используйте полученные данные, чтобы сформулировать осмысленный, максимально содержательный ответ на вопрос пользователя. Ответ должен содержать глубокие знания по теме и быть профессионально сформулированным.
            Составьте вопрос на основе вашего ответа или заданной теме, который поможет дальше развить обсуждение и погрузиться глубже в тему. Вопрос может быть из связанных сфер с выбранной тематикой. Вопросы должны быть по теме.
            Твои ответы а так же вопросы должны быть саксимально практичными и полезными. Ответы могут содержать ссылки, например на разного рода вспомогательные инструменды чтобы достичать результатов.
            Верните ответ и вопрос в формате JSON следующим образом:
            Поле "message" должно содержать ваш ответ на вопрос пользователя. Этот ответ не должен содержать вопрос.
            Поле "question" должно содержать вопрос, сформулированный на основе вашего ответа. Этот вопрос должен быть профессиональным и помочь продвинуть обсуждение дальше.
            Убедитесь, что оба поля "message" и "question" не пусты и содержат содержательную информацию.
            Повторите процесс для следующих вопросов, чтобы дальше развивать тему и предоставлять полезную информацию пользователю.
            Важно отметить, что ответы и вопросы должны быть подготовлены с учетом глубокого знания темы и должны быть профессионально сформулироваными, чтобы обеспечить высокое качество обслуживания пользователей. Если из вопроса не понятно тематика или есть сомнения, лучше задать уточнающий вопрос.`,
        },
        ...chatHistory,
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to getGenerativeModel response");
  }
}

async function vision(filePath) {
  async function fileToGenerativePart(mimeType = "image/png") {
    return {
      inlineData: {
        data: await processImage(filePath),
        mimeType,
      },
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const imageParts = [await fileToGenerativePart()];

    const result = await model.generateContent([
      'your response must be in JSON format and contain fields like {"number": meter_number, "value": meter_readings, "type": meter_type, "is_counter: boolean"}. There must not be any other characters other than the JSON string',
      "if the photo shows a counter then the field is_counter = true if the counter is not shown then is_counter = false",
      "you need to determine if the photo shows a counter.",
      "you need to determine the counter indicators on the counter and write them in the value field. Ignore gray numbers",
      "you need to determine the meter number on the meter and write it in the number field. Ignore gray numbers",
      "you need to determine the type of meter, for example: for water, for gas, for electricity. The value must be written in the type field.",
      "Only consider clearly discernible digits for determining the values of the meter readings.",
      "Exclude any artifacts or faint representations that may appear alongside digits on the same vertical line.",
      ...imageParts,
    ]);
    const response = await result.response;
    const text = response.text();
    const jsonString = extractJsonSubstring(text);
    const data = jsonString ? JSON.parse(extractJsonSubstring(jsonString)) : {};

    return data;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate Google Gemini response");
  }
}

module.exports = { generateText, generateChatText, vision };
