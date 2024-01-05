const genAI = require("./config");
const { processImage } = require("../helpers/imageProcessor");
const { parseJsonString } = require("../helpers/parseJsonString");

const extractJsonSubstring = require("../helpers/extractJsonSubstring");
const prompts = require("../models/prompts");

async function generateText(context, prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  try {
    const chat = await model.startChat({
      history: [
        {
          role: "user",
          parts: context.join(".\n"),
        },
        {
          role: "model",
          parts: prompts.modalGeorgiaApartment,
        },
      ],
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();
    let data = parseJsonString(text);
    console.log("query", data);
    return data ? data : { text };
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate OpenAI response");
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

module.exports = { generateText, vision };
