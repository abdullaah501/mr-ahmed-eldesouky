export const IMAGE_PLACEHOLDER = "/video.jpg";

export function getImageSrc(image) {
  console.log("fasf5saf4sa5fsf", image);
  
  if (!image) return IMAGE_PLACEHOLDER;

  if (typeof image === "string") {
    return image;
  }

  if (image?.cloudId) {
    return `/api/upload/proxyImage/${encodeURIComponent(image.cloudId)}`;
  }

  if (image?.url) {
    return image.url;
  }

  return IMAGE_PLACEHOLDER;
}
