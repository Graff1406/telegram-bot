const parseJsonString = (jsonString) => {
  try {
    const cleanedString = jsonString.replace(/```/g, "");
    return JSON.parse(cleanedString);
  } catch (error) {
    console.error("Ошибка при парсинге JSON:", error);
    return null;
  }
};

module.exports = parseJsonString;
