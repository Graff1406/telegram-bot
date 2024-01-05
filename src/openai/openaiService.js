const openaiInstance = require("./config");
const prompts = require("../models/prompts");
const extractJsonSubstring = require("../helpers/extractJsonSubstring");
const { parseJsonString } = require("../helpers/parseJsonString");

async function generateText(prompt = [], maxTokens = 150) {
  // console.log("GPT", prompt);

  try {
    const response = await openaiInstance.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: prompts.modalGeorgiaApartment,
        },
        { role: "user", content: prompt.join(".\n") },
      ],
      max_tokens: maxTokens,
    });

    const text = response.choices[0].message.content;
    console.log("🚀 ~ file: openaiService.js:23 ~ generateText ~ text:", text);

    let data = parseJsonString(text);
    console.log("query", data);
    return data ? data : { text };
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

module.exports = { generateText, vision };
