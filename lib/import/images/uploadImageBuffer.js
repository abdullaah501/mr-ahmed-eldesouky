import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let _client;

function getImageS3Client() {
  if (_client) return _client;

  _client = new S3Client({
    region: process.env.IDRIVE_REGION,
    endpoint: process.env.IDRIVE_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.IDRIVE_KEY,
      secretAccessKey: process.env.IDRIVE_SECRET,
    },
  });

  return _client;
}

export function generateImageKey(filename) {
  const cleaned = filename.replace(/[^\w.\-]/g, "_") || "image";
  return `${Date.now()}-${cleaned}`;
}

export function buildImageUrl(key) {
  return `${process.env.IDRIVE_ENDPOINT}/${process.env.IDRIVE_BUCKET}/${key}`;
}

export async function uploadImageBuffer(buffer, { filename, contentType } = {}) {
  const name = filename || "image.png";
  const type = contentType || "image/png";
  const key = generateImageKey(name);
  const url = buildImageUrl(key);

  const s3 = getImageS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.IDRIVE_BUCKET,
    Key: key,
    ContentType: type,
    Body: buffer,
  });

  await s3.send(command);

  return { url, cloudId: key };
}
