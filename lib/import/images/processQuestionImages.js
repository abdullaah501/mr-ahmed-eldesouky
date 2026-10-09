import pLimit from "p-limit";
import { uploadImageBuffer } from "./uploadImageBuffer";

const UPLOAD_CONCURRENCY = 5;

async function uploadSingleImage(imageEntry) {
  if (!imageEntry || !imageEntry.buffer) return null;

  const { url, cloudId } = await uploadImageBuffer(imageEntry.buffer, {
    filename: imageEntry.filename || imageEntry.fileName || "image.png",
    contentType: imageEntry.mimeType || imageEntry.mimetype || "image/png",
  });

  return { url, cloudId };
}

async function processItemImages(item, limit, warnings) {
  if (item.image && item.image.buffer) {
    try {
      const result = await limit(() => uploadSingleImage(item.image));
      if (result) {
        item.image = { url: result.url, cloudId: result.cloudId };
      }
    } catch (err) {
      warnings.push({
        code: "IMAGE_EXTRACTION_FAILED",
        message: `Failed to upload image: ${err.message}`,
        stage: "persist",
      });
      item.image = null;
    }
  }

  if (item.options && Array.isArray(item.options)) {
    for (const opt of item.options) {
      if (opt.image && opt.image.buffer) {
        try {
          const result = await limit(() => uploadSingleImage(opt.image));
          if (result) {
            opt.image = { url: result.url, cloudId: result.cloudId };
          }
        } catch (err) {
          warnings.push({
            code: "IMAGE_EXTRACTION_FAILED",
            message: `Failed to upload image: ${err.message}`,
            stage: "persist",
          });
          opt.image = null;
        }
      }
    }
  }
}

export async function processQuestionImages(mappedItems) {
  if (!mappedItems || mappedItems.length === 0) return [];

  const limit = pLimit(UPLOAD_CONCURRENCY);
  const warnings = [];
  const tasks = mappedItems.map((item) => processItemImages(item, limit, warnings));

  await Promise.all(tasks);

  return warnings;
}
