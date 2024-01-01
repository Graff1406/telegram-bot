const openaiInstance = require("./config");

async function generateText(prompt, maxTokens = 150) {
  try {
    const response = await openaiInstance.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "assistant", content: prompt }],
      max_tokens: maxTokens,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

async function vision(
  url,
  prompt = 'If there is a meter displayed in the received image, please read the meter readings and provide them in the response. The expected response format is JSON: {"number": meter_number, "value": meter_readings}. If unclear, provide any information that indirectly indicates a set of digits.',
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

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response from OpenAI:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

module.exports = { generateText, vision };
