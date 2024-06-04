const axios = require("axios");

const getMediaBasedLinks = async (
  pictures = [],
  caption = "",
  addCaptionToIndex = 0
) => {
  if (!Array.isArray(pictures))
    throw new Error("createMediaGroup : Cannot create media group");

  const tabletSizePictures = pictures
    .map((innerArray) => {
      const filteredObject = innerArray.find(
        (obj) => obj.width > 350 && obj.width < 850
      );
      return filteredObject;
    })
    .filter((obj) => obj !== undefined);

  // console.log("pictures", pictures);
  // console.log("tabletSizePictures", tabletSizePictures);

  // return;

  try {
    const media = await Promise.all(
      tabletSizePictures.map(async (pic, i) => {
        const { data } = await axios.get(pic.link, {
          responseType: "arraybuffer",
        });
        const photoBuffer = Buffer.from(data, "binary");
        return {
          type: "photo",
          media: photoBuffer,
          caption: i <= addCaptionToIndex ? caption : "",
          parse_mode: i <= addCaptionToIndex ? "Markdown" : "",
        };
      })
    );

    return media;
  } catch (err) {
    console.log("🚀 ~ err:", err);
  }
};

module.exports = getMediaBasedLinks;
