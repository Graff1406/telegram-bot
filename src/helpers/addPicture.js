const fs = require("fs/promises");
const path = require("path");
const generateRandomID = require("./generateRandomID");

const addPicture = async ({ propertyID, pictures }) => {
  const pathToFile = path.join(__dirname, `../data/pictures.json`);

  try {
    const picture = {
      id: propertyID,
      pictures,
    };
    // Reading existing data from the file
    const dataJSON = await fs.readFile(pathToFile, "utf8");
    let existingData = [];
    // Parsing JSON into an array of objects
    try {
      existingData = JSON.parse(dataJSON);
      existingData.push(picture);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      throw parseError;
    }

    // Converting the updated data back to JSON
    const updatedDataJSON = JSON.stringify(existingData, null, 2);

    // Writing the updated data back to the file
    await fs.writeFile(pathToFile, updatedDataJSON, { encoding: "utf8" });

    // console.log("New object successfully added to file:", pathToFile);

    return picture;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

module.exports = addPicture;
