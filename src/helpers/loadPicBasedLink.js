const axios = require("axios");

const loadPicBasedLink = async (link) => {
  if (link) {
    throw new Error("loadPicBasedLink: Has not link");
  }

  try {
    const { data } = await axios.get(pic.link, {
      responseType: "arraybuffer",
    });

    const photoBuffer = Buffer.from(data, "binary");

    return photoBuffer;
  } catch (err) {
    console.log("🚀 ~ loadPicBasedLink ~ err:", err);
    return null;
  }
};

module.exports = loadPicBasedLink;
