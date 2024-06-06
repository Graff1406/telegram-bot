const admin = require("firebase-admin");
const serviceAccount = require("./data/fb.json");

admin.initializeApp({
  credential: admin.credential.cert({
    ...serviceAccount,
    project_id: process.env.PROJECT_ID,
    client_email: process.env.CLIENT_EMAIL,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

const addUser = async (props) => {
  console.log("🚀 ~ addUser ~ props:", props);
  try {
    await db.collection("users").doc(props.chatID).set(props);
    console.log("User added successfully");
  } catch (err) {
    console.log("🚀 ~ addUser ~ err:", err);
  }
};

const searchUsersByLocationAndTags = async (location, tags, limit = 10) => {
  try {
    let locationQuery = db
      .collection("users")
      .where("country", "==", location.country)
      .where("city", "==", location.city);

    if (location.area) {
      locationQuery = locationQuery.where("area", "==", location.area);
    }

    locationQuery = locationQuery.limit(limit);
    const locationSnapshot = await locationQuery.get();

    const locationDocs = locationSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const tagsQuery = db
      .collection("users")
      .where("tags", "array-contains-any", tags);

    const tagsSnapshot = await tagsQuery.get();
    const tagsDocs = tagsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Объединение результатов и фильтрация уникальных документов
    const combinedDocs = [...locationDocs, ...tagsDocs];
    const uniqueDocs = combinedDocs.filter(
      (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
    );

    // Ограничиваем результаты до limit
    const limitedDocs = uniqueDocs.slice(0, limit);

    if (limitedDocs.length === 0) {
      console.log("No matching documents.");
      return [];
    }

    return limitedDocs;
  } catch (err) {
    console.log("🚀 ~ searchUsersByLocationAndTags ~ err:", err);
    throw err; // Перебрасываем ошибку, чтобы она могла быть обработана вызывающей стороной
  }
};

const deleteDocumentById = async (docId) => {
  if (!docId) {
    console.error("docId не должен быть пустым");
    return null;
  }

  const docIdStr = docId.toString();
  try {
    await db.collection("users").doc(docIdStr).delete();
    console.log(`Документ с ID ${docIdStr} успешно удален из коллекции`);
  } catch (err) {
    console.error("Ошибка при удалении документа:", err);
  }
};

const getDocumentById = async (docId) => {
  if (!docId) {
    console.error("docId не должен быть пустым");
    return null;
  }

  const docIdStr = docId.toString();

  try {
    const docRef = db.collection("users").doc(docIdStr);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log("Документ не найден!");
      return null;
    }

    return { id: doc.id, ...doc.data() };
  } catch (err) {
    console.error("Ошибка при получении документа:", err);
    throw err;
  }
};

module.exports = {
  addUser,
  searchUsersByLocationAndTags,
  deleteDocumentById,
  getDocumentById,
};
