const { SchemaType } = require("@google/generative-ai");
const genAI = require("./config");
const { processImage } = require("../../helpers/imageProcessor");

const extractJsonSubstring = require("../../helpers/extractJsonSubstring");

const typeModel = "gemini-1.5-flash"; // "gemini-pro"

async function generateText(prompt, temperature = 2) {
  const model = genAI.getGenerativeModel({ model: typeModel });

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
  temperature = 2,
  instructions = [""],
}) {
  const model = genAI.getGenerativeModel({
    model: typeModel,
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
          parts: instructions,
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

async function generateChatTextBySchema(
  { userMessage = "", chatHistory = [], temperature = 2 },
  schema
) {
  const chatHistoryCopy = JSON.parse(JSON.stringify(chatHistory));
  const model = genAI.getGenerativeModel({
    model: typeModel,
    generationConfig: schema
      ? {
          temperature,
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      : { temperature },
  });
  try {
    // console.log("🚀 ~ chatHistory:", chatHistoryCopy[1]);
    const chat = model.startChat({
      history: chatHistoryCopy,
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response.text();
    return response;
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
    const model = genAI.getGenerativeModel({ model: typeModel });

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

const generateEmbedContent = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: "embedding-001" });

    const text = "Меня зовут Автан. Я живу в Нико";
    const text2 = "Как зовут человека который живет в Нико?";

    const result = await model.embedContent([text, text2]);
    const embedding = result.embedding;
    console.log(result);
  } catch (error) {
    console.log("🚀 ~ generateEmbedContent ~ error:", error);
  }
};
const generateContentByAudio = async ({ text, base64AudioFile }, schema) => {
  try {
    // Инициализация модели
    const model = genAI.getGenerativeModel({
      model: typeModel,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // Проверка наличия текста и аудиофайла
    if (!text || !base64AudioFile) {
      throw new Error("Text and audio data are required.");
    }

    // Вызов модели для генерации контента
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/mp3",
          data: base64AudioFile,
        },
      },
      { text },
    ]);

    // Проверка ответа модели
    if (!result || !result.response) {
      throw new Error("No response from the generative model.");
    }

    // Возвращаем текстовый ответ
    return result.response.text();
  } catch (error) {
    // Логирование ошибки
    console.error("Error generating content by audio:", error.message);

    // Дополнительная информация об ошибке (если есть)
    if (error.response) {
      console.error(
        "Response Error:",
        error.response.data || error.response.statusText
      );
    }

    // Возвращаем ошибочный ответ или выбрасываем ошибку дальше
    return {
      success: false,
      message: error.message || "An unexpected error occurred.",
    };
  }
};

module.exports = {
  generateText,
  generateChatText,
  generateChatTextBySchema,
  vision,
  generateEmbedContent,
  generateContentByAudio,
  SchemaType,
};
