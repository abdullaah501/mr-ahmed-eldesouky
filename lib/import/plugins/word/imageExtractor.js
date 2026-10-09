import mammoth from "mammoth";

export async function extractWordImages(docxBuffer) {
  const images = [];

  const options = {
    convertImage: mammoth.images.imgElement(function (image) {
      return image.read().then(function (imageBuffer) {
        const idx = images.length;
        const contentType = image.contentType || "image/png";
        const ext = contentType.split("/")[1] || "png";
        const filename = `image_${idx}.${ext}`;

        images.push(Buffer.from(imageBuffer));

        return {
          src: `[IMAGE_${idx}]`,
          alt: filename,
        };
      });
    }),
  };

  const result = await mammoth.convertToHtml({ buffer: docxBuffer }, options);
  let html = result.value;

  html = html.replace(/<\s*img\s+[^>]*src\s*=\s*"\[IMAGE_(\d+)\]"[^>]*\/?\s*>/gi, "[IMAGE_$1]");

  return {
    html,
    imageBuffers: images.map((buf, i) => {
      const contentType = "image/png";
      const ext = "png";
      return {
        buffer: buf,
        mimeType: contentType,
        filename: `image_${i}.${ext}`,
      };
    }),
    warnings: (result.messages || []).map((m) => ({
      code: "MAMMOTH_WARNING",
      message: m.message,
      stage: "parse",
    })),
  };
}
