import sharp, { type Sharp } from "sharp";

export type ImageSource = string | Buffer;

export function loadImage(imageSource: ImageSource): Sharp {
  return sharp(imageSource, { failOn: "error" }).rotate().ensureAlpha();
}
