const fs = require("fs/promises");
const path = require("path");

// File paths
const propertiesFilePath = path.join(__dirname, `../data/properties.json`);
const picturesFilePath = path.join(__dirname, `../data/pictures.json`);

// Helper functions
const readFileData = async (filePath) => {
  try {
    const fileData = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileData);
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error}`);
    throw error;
  }
};

const writeFileData = async (filePath, data) => {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, { encoding: "utf8" });
  } catch (error) {
    console.error(`Error writing file ${filePath}: ${error}`);
    throw error;
  }
};

const findIndexByProperty = (array, property, value) => {
  return array.findIndex((item) => item[property] === value);
};

const removePropertyById = async (agentId, propertyId) => {
  try {
    // Read data from the properties.json file
    let properties = await readFileData(propertiesFilePath);

    // Find the agent by id
    const agentIndex = findIndexByProperty(
      properties,
      "telegramAgentID",
      agentId
    );

    if (agentIndex !== -1) {
      // Find the property by id within the agent
      const propertyIndex = findIndexByProperty(
        properties[agentIndex].properties,
        "id",
        propertyId
      );

      if (propertyIndex !== -1) {
        // Remove the property
        properties[agentIndex].properties.splice(propertyIndex, 1);

        // Update data in the properties.json file
        await writeFileData(propertiesFilePath, properties);

        console.log(
          `Property with id ${propertyId} removed from the properties array.`
        );

        // Read data from the pictures.json file
        let pictures = await readFileData(picturesFilePath);

        // Find pictures by property id
        const pictureIndex = findIndexByProperty(pictures, "id", propertyId);

        if (pictureIndex !== -1) {
          // Remove pictures
          pictures.splice(pictureIndex, 1);

          // Update data in the pictures.json file
          await writeFileData(picturesFilePath, pictures);

          console.log(`Pictures for property with id ${propertyId} removed.`);
        } else {
          console.log(`Pictures for property with id ${propertyId} not found.`);
        }
      } else {
        console.log(`Property with id ${propertyId} not found.`);
      }
    } else {
      console.log(`Agent with id ${agentId} not found.`);
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

module.exports = removePropertyById;
