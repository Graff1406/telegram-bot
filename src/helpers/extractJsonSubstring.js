function extractJsonSubstring(inputString) {
  const match = inputString.match(/\{[^\}]*\}/);

  if (match) {
    return match[0];
  }

  return null;
}

module.exports = extractJsonSubstring;
