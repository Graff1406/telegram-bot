const extractJsonSubstringForGemini = (str) => {
  // Используем регулярное выражение для поиска последовательностей символов '**', '***', '* **'
  const regex = /(\*\*\*|\*\*|\*\s\*\*)/g;
  // Заменяем найденные последовательности символов на один символ '*'
  let result = str.replace(regex, "*");

  // Проверяем, есть ли символ '*' в начале строки
  const startsWithAsterisk = result.startsWith("*");

  // Удаляем начальные звездочки
  while (result.startsWith("*")) {
    result = result.slice(1);
  }

  // Добавляем звездочку в конец строки, если строка начиналась с '*'
  if (startsWithAsterisk && !result.endsWith("*")) {
    result += "*";
  }

  return result?.trim();
};

module.exports = extractJsonSubstringForGemini;
