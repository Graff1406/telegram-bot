const postToGroup = async () => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${process.env.FACEBOOK_DENONA_GROUP_ID}/feed`,
      null,
      {
        params: {
          message: postMessage,
          access_token: process.env.FACEBOOK_APP_TOKEN,
        },
      }
    );
    console.log("Пост успешно опубликован:", response.data);
    return response.data;
  } catch (error) {
    console.error("Ошибка при публикации поста:", error.response.data.error);
  }
};

module.exports = postToGroup;
