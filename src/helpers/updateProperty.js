const fs = require("fs/promises");
const path = require("path");

// Helpers
const generateRandomID = require("./generateRandomID");
const filterAllowedTags = require("./filterAllowedTags");

// Constants
const DEFAULT_SOURCE_ID = "telegramAgentID";
const DEFAULT_SOURCE_NICKNAME = "telegramNickname";
const PROPERTY_FILE_NAME = "properties";
const AGENT_FILE_NAME = "agents";

// File paths
const propertyFilePath = path.join(
  __dirname,
  `../data/${PROPERTY_FILE_NAME}.json`
);
const agentFilePath = path.join(__dirname, `../data/${AGENT_FILE_NAME}.json`);

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

const updateProperty = async ({
  agentID,
  propertyID,
  description,
  agentFirstName,
  agentNickname,
  agentLanguageCode,
  agentPhoneNumbers,
  sourceID = DEFAULT_SOURCE_ID,
  sourceNickname = DEFAULT_SOURCE_NICKNAME,
}) => {
  const randomID = generateRandomID();

  try {
    const property = {
      id: generateRandomID(),
      description: filterAllowedTags(description),
      createdAt: Date.now(),
    };

    // Read existing property data
    const existingPropertyData = await readFileData(propertyFilePath);

    // Check if the provided property ID already exists
    const existingAgentProperty = existingPropertyData.find(
      (item) => item[sourceID] === agentID
    );

    if (existingAgentProperty) {
      const indexProperty = existingAgentProperty.properties.findIndex(
        (item) => item.id === propertyID
      );

      if (indexProperty !== -1) {
        existingAgentProperty.properties[indexProperty] = {
          ...existingAgentProperty.properties[indexProperty],
          description,
          updatedAt: Date.now(),
        };
      } else {
        existingAgentProperty.properties.push(property);
      }
    } else {
      // If the property ID doesn't exist, create a new item with the provided ID and add the new property
      const newAgentProperty = {
        id: randomID,
        [sourceID]: agentID,
        properties: [property],
      };

      existingPropertyData.push(newAgentProperty);
    }

    // Write updated property data
    await writeFileData(propertyFilePath, existingPropertyData);

    // Read existing agent data
    const existingAgentData = await readFileData(agentFilePath);

    // Check if the provided agent ID already exists
    const existingAgent = existingAgentData.find(
      (item) => item[sourceID] === agentID
    );

    if (existingAgent) {
      // Update agent data if changed
      if (existingAgent[sourceNickname] !== agentNickname) {
        existingAgent[sourceNickname] = agentNickname;
      }

      if (existingAgent.firstName !== agentFirstName) {
        existingAgent.firstName = agentFirstName;
      }

      if (!areArraysEqual(existingAgent.phoneNumbers, agentPhoneNumbers)) {
        existingAgent.phoneNumbers = agentPhoneNumbers;
      }
    } else {
      // If the agent ID doesn't exist, create a new item with the provided ID and add the new agent
      const newAgent = {
        id: randomID,
        [sourceID]: agentID,
        [sourceNickname]: agentNickname,
        languageCode: agentLanguageCode,
        phoneNumbers: agentPhoneNumbers,
        firstName: agentFirstName,
      };

      existingAgentData.push(newAgent);
    }

    // Write updated agent data
    await writeFileData(agentFilePath, existingAgentData);

    console.log(
      "----------------------------------------------------------------"
    );
    console.log("New AGENT count:", existingAgentData.length);
    console.log(
      "New PROPERTY count:",
      existingPropertyData.reduce(
        (total, item) => total + (item.properties ? item.properties.length : 0),
        0
      )
    );

    return property;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

// Helper function for array comparison
const areArraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((value, index) => value === arr2[index]);
};

module.exports = updateProperty;
