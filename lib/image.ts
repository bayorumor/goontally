// Crop aspect ratios: person photos match the 11:16 portrait cards; groups
// and avatars are square.
export const PERSON_ASPECT = 11 / 16;
export const SQUARE_ASPECT = 1;

// Cloudinary delivers resized, auto-format (WebP/AVIF) images when the
// transformation is part of the URL:
//   .../image/upload/v123/goontally/persons/3f9c2a1e-….jpg
//   .../image/upload/c_limit,w_400,f_auto,q_auto/v123/goontally/persons/3f9c2a1e-….jpg
// Width is in CSS pixels; it's doubled for high-density screens.
// Non-Cloudinary URLs (e.g. local blob previews) are returned unchanged.
export function thumb(
  url: string,
  width: number,
  opts: { square?: boolean } = {},
) {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || at === -1) return url;

  const w = Math.round(width * 2);
  const t = opts.square
    ? `c_fill,w_${w},h_${w},f_auto,q_auto`
    : `c_limit,w_${w},f_auto,q_auto`;
  const head = url.slice(0, at + marker.length);
  return `${head}${t}/${url.slice(at + marker.length)}`;
}
