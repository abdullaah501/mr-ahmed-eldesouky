import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getImportS3Client } from "./s3Client";

export async function deleteImportObject(key) {
  if (!key) return;

  const s3 = getImportS3Client();
  const command = new DeleteObjectCommand({
    Bucket: process.env.IDRIVE_BUCKET,
    Key: key,
  });

  await s3.send(command);
}
