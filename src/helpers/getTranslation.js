const fs = require("fs/promises");
const path = require("path");
const { links } = require("../data/resource");

const getTranslation = async (languageCode) => {
  const pathToFile = path.join(__dirname, "../data/CRMTranslations.json");

  try {
    // Read data from the file
    const translationsJSON = await fs.readFile(pathToFile, "utf8");

    // Parse JSON into an array of objects
    const translationEntries = JSON.parse(translationsJSON);

    // Create an object to store translations
    const translations = {};

    // Iterate through each entry and extract the translation for the specified language
    translationEntries.forEach((entry) => {
      let translation = entry.body[languageCode] || entry.body["en"];

      // Replace {links} placeholder with actual links
      translation = {
        ...translation,
        text: translation.text.replace(/\{links\}/g, links),
      };

      translations[entry.name] = translation;
    });

    return translations;
  } catch (error) {
    console.error(
      "Error reading or parsing CRMTranslations.json:",
      error.message
    );
    throw error;
  }
};

module.exports = getTranslation;
