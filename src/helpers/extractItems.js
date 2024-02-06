const fs = require("fs/promises");
const path = require("path");

const extractItems = async () => {
  const pathToFilePropertyDescription = path.join(
    __dirname,
    `../data/properties.json`
  );
  const pathToFilePropertyPicture = path.join(
    __dirname,
    `../data/pictures.json`
  );
  const pathToFileAgents = path.join(__dirname, `../data/agents.json`);

  try {
    const descriptionJSON = await fs.readFile(
      pathToFilePropertyDescription,
      "utf8"
    );
    const pictureJSON = await fs.readFile(pathToFilePropertyPicture, "utf8");
    const agentsJSON = await fs.readFile(pathToFileAgents, "utf8");

    // Проверяем, что данные не пусты
    if (!descriptionJSON.trim() || !pictureJSON.trim() || !agentsJSON.trim()) {
      console.error("One or more JSON files are empty.");
      return null;
    }

    const agents = JSON.parse(agentsJSON);
    const properties = JSON.parse(descriptionJSON);
    const pictures = JSON.parse(pictureJSON);

    const mergeData = (agents, properties, pictures) => {
      // Convert pictures to an object for efficient access
      const picturesMap = Object.fromEntries(
        pictures.map((item) => [item.id, item.pictures])
      );

      // Update properties with images
      const mergedProperties = properties.map((agent) => {
        const agentData = agents.find((a) => a.id === agent.id) || {};
        return {
          ...agentData,
          properties: agent.properties.map((property) => {
            const picturesArray = picturesMap[property.id] || [];
            return {
              ...property,
              pictures: picturesArray,
            };
          }),
        };
      });

      return mergedProperties;
    };

    const mergedData = mergeData(agents, properties, pictures);

    return mergedData;
  } catch (error) {
    console.error("Error reading or parsing JSON file:", error.message);
    throw error;
  }
};

module.exports = extractItems;
