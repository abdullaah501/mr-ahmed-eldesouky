import Question from "../../models/Question";

export async function resolveByIds(ids) {
  if (!ids?.length) return new Map();

  const docs = await Question.find({ _id: { $in: ids } }).lean();

  const map = new Map();
  for (const doc of docs) {
    map.set(String(doc._id), doc);
  }
  return map;
}

export async function getQuestionImageIds(ids) {
  if (!ids?.length) return [];

  const docs = await Question.find({ _id: { $in: ids } })
    .select("image.cloudId")
    .lean();

  return docs.reduce((acc, doc) => {
    if (doc.image?.cloudId) acc.push(doc.image.cloudId);
    return acc;
  }, []);
}
