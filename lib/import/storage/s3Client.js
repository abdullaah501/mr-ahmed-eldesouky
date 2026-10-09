import { S3Client } from "@aws-sdk/client-s3";

let _client;

export function getImportS3Client() {
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
