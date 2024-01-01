const genAI = require("./config");
const { processImage } = require("../helpers/imageProcessor");

async function generateText(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  try {
    const result = await model.generateContent([
      prompt,
      "the maximum number of characters in your answer cannot exceed 300 characters",
      "I'm giving you the role of a Telegram bot. Your name is Denona Bot",
      "Your response must be in the same language in which you receive requests from the user",
    ]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

async function vision(
  filePath,
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. Ensure leading zeros are included in the "value" field. If unclear, provide any information indirectly indicating a set of digits. Only consider clearly discernible digits for determining the values of the meter readings. Exclude any artifacts or faint representations that may appear alongside digits on the same vertical line. Specify the type of meter for which the readings are intended, indicating whether it is for water, electricity, gas, or heating'
) {
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
      "you need to determine the counter indicators on the counter and write them in the value field.",
      "you need to determine the meter number on the meter and write it in the number field.",
      "you need to determine the type of meter, for example: for water, for gas, for electricity. The value must be written in the type field.",
      ...imageParts,
    ]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate Google Gemini response");
  }
}

module.exports = { generateText, vision };
