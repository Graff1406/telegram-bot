const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function processImage(fileLink) {
  try {
    const fileId = path.basename(fileLink);
    const localPath = path.join(__dirname, "images", `${fileId}.jpg`);

    const imageStream = fs.createWriteStream(localPath);
    await axios({
      url: fileLink,
      method: "GET",
      responseType: "stream",
    }).then((response) => {
      response.data.pipe(imageStream);
    });

    const base64String = Buffer.from(fs.readFileSync(localPath)).toString(
      "base64"
    );

    fs.unlink(localPath, (err) => {
      if (err) {
        console.error("Error deleting image:", err);
      } else {
        console.log("Image deleted successfully");
      }
    });

    return base64String;
  } catch (error) {
    console.error("Error processing image:", error);
    throw new Error("Error processing image");
  }
}

module.exports = { processImage };
