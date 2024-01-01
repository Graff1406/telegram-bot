const genAI = require("./config");
const { processImage } = require("../helpers/imageProcessor");

async function generateText(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  try {
    const result = await model.generateContent(prompt);
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
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. The expected response format is JSON without double quotes around values: {"number": meter_number, "value": meter_readings}. Please ensure that leading zeros are included in the "value" field, and if unclear, provide any information that indirectly indicates a set of digits'
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
