const fs = require("fs/promises");
const path = require("path");

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
        text: translation.text.replace(
          /\{links\}/g,
          "[Telegram - Denona AI Search](https://t.me/denoname_bot)\n[Telegram - Real State Channel](https://t.me/denona_real_estate)\n[Viber - Real State Channel](https://invite.viber.com/?g2=AQB5%2BBdfLYNcTVJh6%2FTEZgDJoDre8kePwPMUfs1j%2FjtAAUe4lr892SoFDv2BE32A)"
        ),
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
