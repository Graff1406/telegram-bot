const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");
const filePath = path.join(__dirname, "../../collage.jpg");

const createCollage = async (urls) => {
  try {
    // Загрузите все изображения и измените их размеры
    const resizedImages = await Promise.all(
      urls.map(async (url) => {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const imageBuffer = Buffer.from(response.data);
        return sharp(imageBuffer).resize(100, null).toBuffer();
      })
    );

    // Получите максимальную высоту из всех изображений
    const maxHeight = Math.max(
      ...(await Promise.all(
        resizedImages.map(async (imageBuffer) => {
          const metadata = await sharp(imageBuffer).metadata();
          return metadata.height;
        })
      ))
    );

    // Создайте новое изображение с белым фоном
    const collage = sharp({
      create: {
        width: resizedImages.length * 100, // Задайте ширину в соответствии с количеством изображений
        height: maxHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    });

    // Добавьте каждое изображение в коллаж
    let leftOffset = 0;
    for (const imageBuffer of resizedImages) {
      collage.composite([
        {
          input: imageBuffer,
          top: 0,
          left: leftOffset,
        },
      ]);
      leftOffset += 100; // Увеличиваем смещение для следующего изображения
    }

    // Сохраните коллаж как файл
    await collage.toFile(filePath);

    // Прочитайте сохраненный файл и преобразуйте его в base64
    const collageBase64 = await fs.readFile(filePath, { encoding: "base64" });

    // Удалите временный файл
    // await fs.unlink(filePath);

    return collageBase64;
  } catch (error) {
    console.error("Ошибка при создании коллажа:", error);
    throw error;
  }
};

module.exports = createCollage;
