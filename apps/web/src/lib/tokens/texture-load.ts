/**
 * Loads a token image via a plain `HTMLImageElement` instead of Pixi's
 * extension-sniffing `Assets.load` — the browser's own image loader accepts
 * any URL it can fetch (including extensionless/query-string CDN links that
 * match none of Pixi's parsers), the same way the character sheet's `<img>`
 * already displays them (IN-008/WI-032).
 *
 * `crossOrigin` is set so a CORS-permitting host still yields an image whose
 * pixels can be uploaded to WebGL. A host that doesn't send
 * `Access-Control-Allow-Origin` rejects the load instead of silently
 * tainting the canvas — the caller turns that rejection into a visible
 * placeholder rather than a blank white square.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}
