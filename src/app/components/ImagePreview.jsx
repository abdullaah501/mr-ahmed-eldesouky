"use client";

import Image from "next/image";
import { getImageSrc, IMAGE_PLACEHOLDER } from "./getImageSrc";

export { getImageSrc, IMAGE_PLACEHOLDER };

export default function ImagePreview({
  image,
  width = 400,
  height = 400,
  alt = "",
  ...props
}) {
  const src = getImageSrc(image);

  const imageProps = { src, alt, width, height, ...props };
  if (props.fill) {
    delete imageProps.width;
    delete imageProps.height;
  }

  return <Image {...imageProps} />;
}
