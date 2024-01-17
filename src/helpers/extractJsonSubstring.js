const extractJsonSubstring = (inputString) => {
  const startIndex = inputString.indexOf("{");
  const endIndex = inputString.lastIndexOf("}");

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return inputString.substring(startIndex, endIndex + 1);
  } else {
    console.error("Отсутствуют символы { или } или порядок некорректен.");
    return null;
  }
};

module.exports = extractJsonSubstring;
