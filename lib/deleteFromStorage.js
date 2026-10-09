import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.IDRIVE_REGION,
  endpoint: process.env.IDRIVE_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.IDRIVE_KEY,
    secretAccessKey: process.env.IDRIVE_SECRET,
  },
});

export async function deleteFromStorage(cloudId) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.IDRIVE_BUCKET ?? process.env.NEXT_PUBLIC_IDRIVE_BUCKET,
    Key: cloudId,
  });

  try {
    await s3.send(command);
    console.log(`Deleted: ${cloudId}`);
  } catch (err) {
    console.error("Delete failed:", err);
  }
}

export async function deleteMultipleFromStorage(keys = []) {
  if (!keys.length) return;

  try {
    const objectsToDelete = keys.map((key) => ({ Key: key }));

    if (!objectsToDelete.length) return;

    const command = new DeleteObjectsCommand({
      Bucket: process.env.NEXT_PUBLIC_IDRIVE_BUCKET,
      Delete: {
        Objects: objectsToDelete,
        Quiet: false,
      },
    });

    console.log("Deleting keys 🗑️", objectsToDelete.map((o) => o.Key));

    const data = await s3.send(command);
    console.log("Delete result ✅:", data);
    return data;
  } catch (err) {
    console.error("Delete failed ❌:", err);
    throw err;
  }
}
