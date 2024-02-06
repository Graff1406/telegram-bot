const extractJsonSubstring = (inputString) => {
  // Remove <br> and </br> from the string
  const stringWithoutBr = inputString.replace(/<\/?br\s?\/?>/g, "\n");

  // Find the starting and ending indices for the JSON substring
  const startIndex = stringWithoutBr.indexOf("{");
  const endIndex = stringWithoutBr.lastIndexOf("}");

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    // Return the JSON substring
    return stringWithoutBr
      .substring(startIndex, endIndex + 1)
      .replace(/\n\s*/g, "");
  } else {
    console.error("Missing { or } characters, or the order is incorrect.");
    return null;
  }
};

module.exports = extractJsonSubstring;
