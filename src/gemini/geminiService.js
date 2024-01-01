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
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. The expected response format is JSON without double quotes around values: {"number": meter_number, "value": meter_readings, "type": meter_type}. Ensure leading zeros are included in the "value" field. If unclear, provide any information indirectly indicating a set of digits. Only consider clearly discernible digits for determining the values of the meter readings. Exclude any artifacts or faint representations that may appear alongside digits on the same vertical line. Specify the type of meter for which the readings are intended, indicating whether it is for water, electricity, gas, or heating'
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

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate Google Gemini response");
  }
}

module.exports = { generateText, vision };
