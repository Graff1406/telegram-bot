function parseJsonString(jsonString) {
  try {
    const jsonObject = JSON.parse(jsonString);
    if (typeof jsonObject === "object" && jsonObject !== null) {
      return jsonObject;
    } else {
      console.log("Неверный формат JSON: объект не был возвращен.");
      return null;
    }
  } catch (error) {
    console.log(`Ошибка при парсинге JSON: ${error.message}`);
    return null;
  }
}

module.exports = { parseJsonString };
