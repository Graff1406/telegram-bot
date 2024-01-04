const genAI = require("./config");
const { processImage } = require("../helpers/imageProcessor");

const extractJsonSubstring = require("../helpers/extractJsonSubstring");

async function generateText(context, prompt) {
  console.log("Demini", context, prompt);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  try {
    // const result = await model.generateContent([
    //   `Я определил тебе роль высокопрофессионального менеджер по продажам Алекс который отлично понимает продажи и маркетинг а так же хорошо понимает в психологии чтобы составить психологический портрет клиента.
    // Ты работаешьв компании застройщика недвижимости Denona. Ты обязательно должен следовать указанной инструкции.
    // Инструкция для тебя:
    //  - ты должен общаться в формате диалога - вопрос / ответ;
    //  - принимать сообщения через мессерджер и давать релевантный ответ;
    //  - провести клиента через воронку продаж чтобы в итоже клиент оставил заявку на просмотр или позвонил реальному менеджеру;
    //  - предоставить достоверную информацию о состоянии стройки и о наличии предложении;
    //  - понимать потребности клиента и предлогать релевантные варианты квартир;
    //  - клиент не должен знать что говрит с ботом, а должен быть убежден что говорит с настоящим человеком консультантом по прождажам;
    //  - не должен упоинать о воронке продаж, то есть клиент не должен знать что сейчас ты его проводишь через воронку продаж;
    //  - ты должен предоставить максимально персонализированный и естественный опыт общения, чтобы клиент не ощущал, что его ведут через воронку продаж, а скорее чувствовал внимание и заботу.
    //  - твое первое сообщение должен быть лаконичным, приветствующим, предстовляющий компанию, предлогающий клиенту уточнить свои предпочтения и не более того;
    // - ты должен общатся с клиентов в режиме диалога, то есть дожидатся ответ от клиента и не писать длинные сообщения, нужно быть лаконичным;
    //  - в тексте получаемого от тебя должен быть только тест от имени менеджера по продажам и ничего другого;
    //  - сообщение от клента которое касается деньег, бюджета, финансов, расчетов всегда нужно уточнять валюту которую имеет введу клиент;`,
    //   `Ты должен строить ответы с учетом контекста. Контекст это текущий диалог бота(тебя) с клиентом. Ты должен из контекста понимать о чем ты уже говорил с клентом и строить давать ответы из контекста.
    //  Контекст:
    //  ${prompt.join("\n")}`,
    // ]);
    const chat = await model.startChat({
      history: [
        {
          role: "user",
          parts: context,
        },
        {
          role: "model",
          parts: `Ты высокопрофессионального менеджер по продажам Алекс который отлично понимает продажи и маркетинг а так же хорошо понимает в психологии чтобы составить психологический портрет клиента.
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
      ],
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate OpenAI response");
  }
}

async function vision(filePath) {
  async function fileToGenerativePart(mimeType = "image/png") {
    return {
      inlineData: {
        data: await processImage(filePath),
        mimeType,
      },
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const imageParts = [await fileToGenerativePart()];

    const result = await model.generateContent([
      'your response must be in JSON format and contain fields like {"number": meter_number, "value": meter_readings, "type": meter_type, "is_counter: boolean"}. There must not be any other characters other than the JSON string',
      "if the photo shows a counter then the field is_counter = true if the counter is not shown then is_counter = false",
      "you need to determine if the photo shows a counter.",
      "you need to determine the counter indicators on the counter and write them in the value field. Ignore gray numbers",
      "you need to determine the meter number on the meter and write it in the number field. Ignore gray numbers",
      "you need to determine the type of meter, for example: for water, for gas, for electricity. The value must be written in the type field.",
      "Only consider clearly discernible digits for determining the values of the meter readings.",
      "Exclude any artifacts or faint representations that may appear alongside digits on the same vertical line.",
      ...imageParts,
    ]);
    const response = await result.response;
    const text = response.text();
    const jsonString = extractJsonSubstring(text);
    const data = jsonString ? JSON.parse(extractJsonSubstring(jsonString)) : {};

    return data;
  } catch (error) {
    console.error("Error generating response from Google Gemini:", error);
    throw new Error("Failed to generate Google Gemini response");
  }
}

module.exports = { generateText, vision };
