const fs = require("fs/promises");
const path = require("path");
const { links } = require("../data/resource");

const getTranslation = async (languageCode) => {
  try {
    // Собираем путь к файлу с помощью деструктуризации
    const pathToFile = path.join(
      __dirname,
      "..",
      "data",
      "CRMTranslations.json"
    );

    // Читаем данные из файла
    const translationsJSON = await fs.readFile(pathToFile, "utf8");

    // Парсим JSON в массив объектов
    const translationEntries = JSON.parse(translationsJSON);

    // Создаем объект для хранения переводов
    const translations = {};

    // Итерируемся по каждой записи и извлекаем перевод для указанного языка
    translationEntries.forEach((entry) => {
      // Проверяем наличие перевода для указанного языка, используя явную проверку
      const translation = entry.body.hasOwnProperty(languageCode)
        ? entry.body[languageCode]
        : entry.body["en"];

      // Заменяем плейсхолдеры в тексте на реальные ссылки
      const text = translation.text.replace(/\{links\}/g, links);

      translations[entry.name] = { ...translation, text };
    });

    return translations;
  } catch (error) {
    // Более детальная обработка ошибок
    console.error("Error reading or parsing CRMTranslations.json:", error);
    throw error;
  }
};

module.exports = getTranslation;
