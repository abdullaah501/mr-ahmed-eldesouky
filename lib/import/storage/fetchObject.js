import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getImportS3Client } from "./s3Client";

export async function getImportObject(key) {
  if (!key) {
    throw new Error("key is required");
  }

  const s3 = getImportS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.IDRIVE_BUCKET,
    Key: key,
  });

  const response = await s3.send(command);
  const bytes = await response.Body.transformToByteArray();

  return {
    bytes,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength || bytes.byteLength,
  };
}
