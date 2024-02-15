const openaiInstance = require("./config");
const instructions = require("../../models/instructions");
const extractJsonSubstring = require("../../helpers/extractJsonSubstring");
const path = require("path");
const fs = require("fs");
const fsP = require("fs/promises");

const createAssistantAndThread = async (
  instruction,
  readFile = false,
  model = "gpt-3.5-turbo-0125"
) => {
  let fileIds = [];

  if (readFile) {
    const filePath = path.join(__dirname, "../../data/properties.json");
    const fileData = await fsP.readFile(filePath, "utf8");

    const isEmptyFile =
      !fileData || !fileData.trim() || fileData.trim() === "[]";

    if (!isEmptyFile) {
      const file = await openaiInstance.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants",
      });

      fileIds = [file.id];
    }
  }

  const assistant = await openaiInstance.beta.assistants.create({
    name: "Denona",
    instructions: instruction,
    tools: [
      {
        type: readFile && fileIds.length > 0 ? "retrieval" : "code_interpreter",
      },
    ],
    model, // gpt-3.5-turbo-0125, gpt-3.5-turbo-1106 , gpt-4-1106-preview, gpt-4-0125-preview
    file_ids: fileIds.length ? fileIds : undefined,
    // response_format: { type: "json_object" },
  });

  const thread = await openaiInstance.beta.threads.create();

  return { assistant, thread, fileIds };
};

async function generateText({
  chatHistory = [],
  maxTokens = 4000,
  instruction,
}) {
  if (!instruction) throw new Error("No instruction");
  try {
    const messages = [
      {
        role: "system",
        content: instruction,
      },
      ...chatHistory,
    ];

    const response = await openaiInstance.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      response_format: { type: "json_object" },
      messages,
      max_tokens: maxTokens,
    });

    const text = response.choices[0].message.content;
    return text;
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

async function generateChatResponse({ instruction, readFile, model }) {
  if (!instruction) throw new Error("No instruction");
  try {
    const { assistant, thread, fileIds } = await createAssistantAndThread(
      instruction,
      readFile,
      model
    );

    const run = async (userMessage) => {
      await openaiInstance.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userMessage,
        file_ids: fileIds,
      });

      const runInstance = await openaiInstance.beta.threads.runs.create(
        thread.id,
        {
          assistant_id: assistant.id,
        }
      );

      const getStatus = async () =>
        await openaiInstance.beta.threads.runs.retrieve(
          thread.id,
          runInstance.id
        );

      let runStatus = await getStatus();

      while (runStatus.status !== "completed") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await getStatus();
      }

      const messages = await openaiInstance.beta.threads.messages.list(
        thread.id
      );

      // messages.data.forEach((m, i) =>
      //   console.log(m.role + ": ", m.content[0].text.value)
      // );

      const lastItem = messages.data
        .filter((msg) => msg.role === "assistant")
        .shift();

      return lastItem.content[0].text.value;
    };

    return run;
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

async function vision(
  url,
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. The expected response format is JSON without double quotes around values: {"number": meter_number, "value": meter_readings, "type": meter_type, "is_counter: boolean"}. if the photo shows a counter then the field is_counter = true if the counter is not shown then is_counter = false. Ensure leading zeros are included in the "value" field. If unclear, provide any information indirectly indicating a set of digits. Only consider clearly discernible digits for determining the values of the meter readings. Exclude any artifacts or faint representations that may appear alongside digits on the same vertical line. Specify the type of meter for which the readings are intended, indicating whether it is for water, electricity, gas, or heating. Ignore gray numbers',
  maxTokens = 150
) {
  try {
    const response = await openaiInstance.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: url,
              },
            },
          ],
        },
      ],
      max_tokens: maxTokens,
    });

    const jsonString = extractJsonSubstring(
      response.choices[0].message.content
    );

    const data = jsonString ? JSON.parse(jsonString) : {};

    return data;
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

module.exports = { generateText, generateChatResponse, vision };
