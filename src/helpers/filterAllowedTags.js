const cheerio = require("cheerio");

const filterAllowedTags = (html) => {
  const allowedTags = [
    "b",
    "strong",
    "i",
    "em",
    "code",
    "u",
    "a",
    "pre",
    "strike",
    "s",
    "del",
  ];

  try {
    const $ = cheerio.load(html, { decodeEntities: false });

    const removeNotAllowedTags = (element) => {
      $(element)
        .children()
        .each((index, childElement) => {
          removeNotAllowedTags(childElement);
        });

      if (!allowedTags.includes(element.name)) {
        $(element).replaceWith($(element).html());
      }
    };

    $.root()
      .children()
      .each((index, element) => {
        removeNotAllowedTags(element);
      });

    const filteredHtml = $.html();
    // console.log("Отфильтрованный HTML:", filteredHtml);
    return filteredHtml;
  } catch (error) {
    console.error("Ошибка при фильтрации HTML:", error.message);
    return html;
  }
};

module.exports = filterAllowedTags;
