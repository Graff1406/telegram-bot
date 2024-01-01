const genAI = require("./config");
const fs = require("fs");

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
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. The expected response format is JSON: {"number": meter_number, "value": meter_readings}. If unclear, provide any information that indirectly indicates a set of digits.'
) {
  function fileToGenerativePart(path, mimeType = "image/png") {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(path)).toString("base64"),
        mimeType,
      },
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const imageParts = [fileToGenerativePart("src/telegram/img/counter-3.jpg")];

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
