const fs = require("fs/promises");
const path = require("path");

const removePropertyById = async (agentId, propertyId) => {
  const pathToFileProperty = path.join(__dirname, `../data/properties.json`);
  const pathToFilePictures = path.join(__dirname, `../data/pictures.json`);

  try {
    // Read data from the properties.json file
    const dataJSON = await fs.readFile(pathToFileProperty, "utf8");

    // Parse JSON into an array of objects
    let properties = JSON.parse(dataJSON);

    // Find the agent by id
    const agentIndex = properties.findIndex(
      (agent) => agent.telegramAgentID === agentId
    );

    if (agentIndex !== -1) {
      // Find the property by id within the agent
      const propertyIndex = properties[agentIndex].properties.findIndex(
        (property) => property.id === propertyId
      );

      if (propertyIndex !== -1) {
        // Remove the property
        properties[agentIndex].properties.splice(propertyIndex, 1);

        // Update data in the properties.json file
        await fs.writeFile(
          pathToFileProperty,
          JSON.stringify(properties, null, 2),
          "utf8"
        );

        console.log(
          `Property with id ${propertyId} removed from the properties array.`
        );

        // Read data from the pictures.json file
        const picturesJSON = await fs.readFile(pathToFilePictures, "utf8");

        // Parse JSON into an array of objects
        let pictures = JSON.parse(picturesJSON);

        // Find pictures by property id
        const pictureIndex = pictures.findIndex(
          (picture) => picture.id === propertyId
        );

        if (pictureIndex !== -1) {
          // Remove pictures
          pictures.splice(pictureIndex, 1);

          // Update data in the pictures.json file
          await fs.writeFile(
            pathToFilePictures,
            JSON.stringify(pictures, null, 2),
            "utf8"
          );

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
