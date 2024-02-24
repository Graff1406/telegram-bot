const axios = require("axios");

let accessToken;

const getAccessToken = async () => {
  const res = await axios.get(
    "https://graph.facebook.com/v12.0/oauth/access_token",
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token:
          accessToken || process.env.FACEBOOK_SHIRT_ACCESS_TOKEN,
      },
    }
  );

  return res.data;
};

const autoRefreshAccessTokenFacebook = async () => {
  if (!accessToken) {
    const { access_token, expires_in } = await getAccessToken();
    accessToken = access_token;

    const expiresIn = Math.max(expires_in - 100000, 0);

    console.log(
      "Access token for FB: ",
      accessToken.substring(0, 10),
      " ",
      Date.now()
    );

    setTimeout(autoRefreshAccessTokenFacebook, expiresIn);
  }
};

const getQueryInitData = async (dir) => {
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
  content = "",
  photos = [],
  agentNickname,
}) => {
  content = content.replace(/[_*]/g, "");
  content += `\nTelegram: https://t.me/${agentNickname}`;
  photos = photos.map((p) => p[p.length - 1].link);

  try {
    const media = await uploadImages(photos);
    // return;

    const { endpoint, params } = await getQueryInitData("feed");

    const response = await axios.post(
      endpoint,
      {
        message: content,
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

module.exports = { postToFacebookGroup, autoRefreshAccessTokenFacebook };

// attached_media: [
//   { media_fbid: "122113543580199485" },
//   { media_fbid: "122113542518199485" },
//   { media_fbid: "122113542890199485" },
//   { media_fbid: "122113543160199485" },
// ],
