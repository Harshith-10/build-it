import { defaultUrlTransform } from "react-markdown";

/**
 * Custom URL transformer for react-markdown.
 * Allows safe image data URIs (e.g. data:image/png;base64,...)
 * while delegating standard URLs to defaultUrlTransform for XSS safety.
 */
export function markdownUrlTransform(url: string): string {
  if (url.startsWith("data:image/")) {
    return url;
  }
  return defaultUrlTransform(url);
}

