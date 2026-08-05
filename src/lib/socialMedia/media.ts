import sharp from "sharp";

import type { SocialVisual } from "./types";
import { renderSocialVisualSvg } from "./visual";

export async function renderSocialVisualJpeg(visual: SocialVisual, slide: number): Promise<Buffer> {
  const svg = renderSocialVisualSvg(visual, slide);
  return sharp(Buffer.from(svg, "utf8"))
    .resize(1080, 1080, { fit: "fill" })
    .flatten({ background: "#06100e" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
