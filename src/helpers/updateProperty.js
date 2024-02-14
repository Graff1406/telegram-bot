const fs = require("fs/promises");
const path = require("path");

// Helpers

const generateRandomID = require("./generateRandomID");
const filterAllowedTags = require("./filterAllowedTags");

const updateProperty = async ({
  agentID,
  propertyID,
  description,
  agentFirstName,
  agentNickname,
  agentLanguageCode,
  agentPhoneNumbers,
  sourceID = "telegramAgentID",
  sourceNickname = "telegramNickname",
  propertyFileName = "properties",
  agentFileName = "agents",
}) => {
  const propertyPath = path.join(__dirname, `../data/${propertyFileName}.json`);
  const agentPath = path.join(__dirname, `../data/${agentFileName}.json`);
  const randomID = generateRandomID();
  try {
    const property = {
      id: generateRandomID(),
      description: filterAllowedTags(description),
      createdAt: Date.now(),
    };

    // Reading existing property data from the file
    const propertyJSON = await fs.readFile(propertyPath, "utf8");
    let existingPropertyData = [];
    try {
      existingPropertyData = JSON.parse(propertyJSON);
    } catch (parseError) {
      console.error("Error parsing property JSON:", parseError);
      throw parseError;
    }

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

    // Converting the updated property data back to JSON
    const updatedPropertyJSON = JSON.stringify(existingPropertyData, null, 2);

    // Writing the updated property data back to the file
    await fs.writeFile(propertyPath, updatedPropertyJSON, { encoding: "utf8" });

    // Now, update the agent data
    // Reading existing agent data from the file
    const agentJSON = await fs.readFile(agentPath, "utf8");
    let existingAgentData = [];
    try {
      existingAgentData = JSON.parse(agentJSON);
    } catch (parseError) {
      console.error("Error parsing agent JSON:", parseError);
      throw parseError;
    }

    // Check if the provided agent ID already exists
    const existingAgent = existingAgentData.find(
      (item) => item[sourceID] === agentID
    );

    if (existingAgent) {
      // Update the agentNickname if it has changed
      if (existingAgent.telegramNickname !== agentNickname) {
        existingAgent.telegramNickname = agentNickname;
      }

      if (existingAgent.firstName !== agentFirstName) {
        existingAgent.firstName = agentFirstName;
      }

      function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
          if (arr1[i] !== arr2[i]) return false;
        }
        return true;
      }

      if (!arraysEqual(existingAgent.phoneNumbers, agentPhoneNumbers)) {
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

    // Converting the updated agent data back to JSON
    const updatedAgentJSON = JSON.stringify(existingAgentData, null, 2);

    // Writing the updated agent data back to the file
    await fs.writeFile(agentPath, updatedAgentJSON, { encoding: "utf8" });

    const JSON_A = await fs.readFile(agentPath, "utf8");
    const a = JSON.parse(JSON_A);
    const JSON_P = await fs.readFile(propertyPath, "utf8");
    const p = JSON.parse(JSON_P);

    console.log("New AGENT: ", a.length);
    console.log("New PROPERTY: ", p.length);

    return property;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

module.exports = updateProperty;
