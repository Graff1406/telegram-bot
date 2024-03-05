const axios = require("axios");

let accessToken = {
  tbilisi: "",
  batumi: "",
};

const getAccessToken = async (token) => {
  const res = await axios.get(
    "https://graph.facebook.com/v12.0/oauth/access_token",
    {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: token,
      },
    }
  );

  return res.data;
};

const autoRefreshAccessTokenFacebook = async () => {
  try {
    const [
      { access_token: tbilisiAccessToken, expires_in: tbilisiExpiresIn },
      { access_token: batumiAccessToken, expires_in: batumiExpiresIn },
    ] = await Promise.all([
      getAccessToken(process.env.FACEBOOK_SHIRT_ACCESS_TOKEN_TBILISI_PAGE),
      getAccessToken(process.env.FACEBOOK_SHIRT_ACCESS_TOKEN_BATUMI_PAGE),
    ]);

    accessToken.tbilisi = tbilisiAccessToken;
    accessToken.batumi = batumiAccessToken;

    const minExpiresIn = Math.min(tbilisiExpiresIn, batumiExpiresIn);

    const expiresIn = Math.max(minExpiresIn - 120000, 0);

    setTimeout(autoRefreshAccessTokenFacebook, expiresIn);
    console.log(
      "Have got access token for FBL: ",
      tbilisiAccessToken.substring(0, 5),
      batumiAccessToken.substring(0, 5)
    );
  } catch (error) {
    console.log("autoRefreshAccessTokenFacebook", error);
  }
};

const getQueryInitData = (dir, pageID, location) => {
  return {
    endpoint: `https://graph.facebook.com/v19.0/${pageID}/${dir}`,
    params: {
      access_token: accessToken[location],
    },
  };
};

const uploadImages = async (images, pageID, location) => {
  const { endpoint, params } = getQueryInitData("photos", pageID, location);

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
  location,
}) => {
  if (!location)
    throw new Error("Did not passed a location to postToFacebookGroup");

  const pageID =
    location === "tbilisi"
      ? process.env.FACEBOOK_TBILISI_PAGE_ID
      : process.env.FACEBOOK_BATUMI_PAGE_ID;

  content = content.replace(/[_*]/g, "");

  if (agentNickname) content += `\nTelegram: https://t.me/${agentNickname}`;

  photos =
    Array.isArray(photos) && photos.length > 0 && Object.hasOwnProperty("link")
      ? photos.map((p) => p[p.length - 1].link)
      : photos;

  try {
    const media = await uploadImages(photos, pageID, location);

    const { endpoint, params } = getQueryInitData("feed", pageID, location);

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
