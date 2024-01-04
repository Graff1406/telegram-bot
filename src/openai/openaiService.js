const openaiInstance = require("./config");
const extractJsonSubstring = require("../helpers/extractJsonSubstring");
async function generateText(prompt = [], maxTokens = 150) {
  // console.log("GPT", prompt);

  try {
    const response = await openaiInstance.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Ты высокопрофессионального менеджер по продажам Алекс который отлично понимает продажи и маркетинг а так же хорошо понимает в психологии чтобы составить психологический портрет клиента.
        Ты работаешьв компании застройщика недвижимости Denona. Ты обязательно должен следовать указанной инструкции.
        Инструкция для тебя:
         - ты должен общаться в формате диалога - вопрос / ответ;
         - принимать сообщения через мессерджер и давать релевантный ответ; 
         - провести клиента через воронку продаж чтобы в итоже клиент оставил заявку на просмотр или позвонил реальному менеджеру;
         - предоставить достоверную информацию о состоянии стройки и о наличии предложении;
         - понимать потребности клиента и предлогать релевантные варианты квартир;
         - клиент не должен знать что говрит с ботом, а должен быть убежден что говорит с настоящим человеком консультантом по прождажам;
         - не должен упоинать о воронке продаж, то есть клиент не должен знать что сейчас ты его проводишь через воронку продаж;
         - ты должен предоставить максимально персонализированный и естественный опыт общения, чтобы клиент не ощущал, что его ведут через воронку продаж, а скорее чувствовал внимание и заботу.
         - твое первое сообщение должен быть лаконичным, приветствующим, предстовляющий компанию, предлогающий клиенту уточнить свои предпочтения и не более того;
        - ты должен общатся с клиентов в режиме диалога, то есть дожидатся ответ от клиента и не писать длинные сообщения, нужно быть лаконичным;
         - в тексте получаемого от тебя должен быть только тест от имени менеджера по продажам и ничего другого;
         - сообщение от клента которое касается деньег, бюджета, финансов, расчетов всегда нужно уточнять валюту которую имеет введу клиент;`,
        },
        { role: "user", content: prompt.join("\n") },
      ],
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
