const admin = require("firebase-admin");
const serviceAccount = require("./fb-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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
    // Запрос по локации
    const locationQuery = await db
      .collection("users")
      .where("country", "==", location.country)
      .where("city", "==", location.city)
      .where("area", "==", location.area)
      .limit(limit)
      .get();

    const locationDocs = locationQuery.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Запрос по тегам
    const tagsQuery = await db
      .collection("users")
      .where("tags", "array-contains-any", tags)
      .get();

    const tagsDocs = tagsQuery.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Объединяем результаты на стороне сервера
    const combinedDocs = [...locationDocs, ...tagsDocs];
    const uniqueDocs = combinedDocs.filter(
      (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
    );

    if (uniqueDocs.length === 0) {
      console.log("No matching documents.");
      return [];
    }

    return uniqueDocs;
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
