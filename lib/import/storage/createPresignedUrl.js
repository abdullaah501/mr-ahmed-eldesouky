import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getImportS3Client } from "./s3Client";
import { DEFAULT_MAX_FILE_SIZE } from "../shared/file";

export async function createImportPresignedUrl({ filename, filesize, filetype }) {
  if (!filename || typeof filename !== "string") {
    throw new Error("filename is required");
  }
  if (typeof filesize !== "number" || filesize <= 0) {
    throw new Error("filesize must be a positive number");
  }
  if (filesize > DEFAULT_MAX_FILE_SIZE) {
    const maxMB = Math.round(DEFAULT_MAX_FILE_SIZE / 1024 / 1024);
    throw new Error(`File too large. Maximum allowed is ${maxMB} MB.`);
  }

  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const key = `imports/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
  const contentType = filetype || "application/octet-stream";

  const s3 = getImportS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.IDRIVE_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return { presignedUrl, key, contentType, expiresIn: 3600 };
}
