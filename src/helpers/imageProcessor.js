const axios = require("axios");

async function processImage(fileUrl) {
  try {
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const base64String = Buffer.from(response.data, "binary").toString(
      "base64"
    );

    return base64String;
  } catch (error) {
    console.error("Error processing image:", error);
    throw new Error("Error processing image");
  }
}

module.exports = { processImage };
