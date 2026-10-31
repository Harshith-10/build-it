import { defaultUrlTransform } from "react-markdown";

/**
 * Allowed raster image MIME types for data URIs.
 * SVG (image/svg+xml) is intentionally excluded to prevent XSS via embedded scripts.
 */
const SAFE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

/**
 * Custom URL transformer for react-markdown.
 * Allows safe raster image data URIs (PNG, JPEG, WebP, GIF)
 * while delegating standard URLs to defaultUrlTransform for XSS safety.
 */
export function markdownUrlTransform(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (SAFE_IMAGE_DATA_URL_REGEX.test(trimmed)) {
    return trimmed;
  }
  return defaultUrlTransform(url);
}
