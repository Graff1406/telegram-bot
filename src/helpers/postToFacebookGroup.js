const axios = require("axios");

let accessToken;

const getQueryInitData = async (dir) => {
  const getAccessToken = async () => {
    const res = await axios.get(
      "https://graph.facebook.com/v12.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: process.env.FACEBOOK_SHIRT_ACCESS_TOKEN,
        },
      }
    );

    return res.data;
  };

  if (!accessToken) {
    const { access_token, expires_in } = await getAccessToken();
    accessToken = access_token;

    const expiresIn = expires_in - 20000;

    setTimeout(() => {}, !!expiresIn ? expiresIn : expires_in);
  }

  return {
    endpoint: `https://graph.facebook.com/v19.0/${process.env.FACEBOOK_DENONA_GROUP_ID}/${dir}`,
    params: {
      access_token: accessToken,
    },
  };
};

const uploadImages = async (images) => {
  const { endpoint, params } = await getQueryInitData("photos");

  const items = [];

  for (const image of images) {
    const response = await axios.post(
      endpoint,
      {
        url: image,
        published: false,
      },
      { params }
    );

    const media_fbid = response.data.id;
    items.push({ media_fbid });
  }

  return items;
};

const postToFacebookGroup = async ({
  message = "Test",
  images = [
    "https://avatars.mds.yandex.net/get-kinopoisk-image/1946459/c7aecd81-2acb-4d0a-9809-2553cd590365/1920x",
    "https://avatars.mds.yandex.net/get-kinopoisk-image/1773646/0291fda2-ca34-46cf-9bdc-3754e16d25f9/1920x",
  ],
}) => {
  try {
    const media = await uploadImages(images);
    // return;

    const { endpoint, params } = await getQueryInitData("feed");

    const response = await axios.post(
      endpoint,
      {
        message,
        attached_media: media,
      },
      { params }
    );
    console.log("Пост успешно опубликован:", response && response.data);
    return response.data;
  } catch (error) {
    console.error("Ошибка при публикации поста:", error.response.data);
    // throw new Error(error.message.data);
  }
};

module.exports = postToFacebookGroup;

// attached_media: [
//   { media_fbid: "122113543580199485" },
//   { media_fbid: "122113542518199485" },
//   { media_fbid: "122113542890199485" },
//   { media_fbid: "122113543160199485" },
// ],
