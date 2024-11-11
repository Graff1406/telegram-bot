const fs = require("fs");
const path = require("path");

// Проверим абсолютный путь к файлу principals.md
const filePath = path.join(__dirname, "../data", "principals.md");

console.log("Путь к файлу:", filePath); // Отладочный вывод для проверки пути

// Чтение содержимого файла .md
let principals;
try {
  principals = fs.readFileSync(filePath, "utf8");
  console.log("Файл успешно прочитан");
} catch (err) {
  console.error("Ошибка при чтении файла:", err);
  principals = ""; // Присваиваем пустую строку, если произошла ошибка
}

// Экспорт содержимого
module.exports = principals;
