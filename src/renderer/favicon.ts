// The site icon, inlined as a data URI rather than served as a file. A page
// stays one object with one cache policy, the stack has nothing extra to
// upload, and there is no second request that can 404.
//
// Drawn for 16 pixels: a disc of radius 13 and eight rays that all run from
// radius 18 to radius 25 on a 64-unit grid, so the rays read as one ring
// rather than as two sets of four. To grow the sun, raise the disc radius and
// both ray radii together.
//
// The field is a mid sky blue rather than the pale CSS `skyblue`, because pale
// blue and a yellow sun sit at nearly the same relative luminance (about 0.55
// against 0.71) and at tab size the sun stops being a shape on a field.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#4A90D9"/>
<circle cx="32" cy="32" r="13" fill="#FFD93B"/>
<g stroke="#FFD93B" stroke-width="6.5" stroke-linecap="round">
<path d="M32 14V7M32 50v7M14 32H7M50 32h7"/>
<path d="M19.3 19.3l-5-5M44.7 19.3l5-5M44.7 44.7l5 5M19.3 44.7l-5 5"/>
</g>
</svg>`;

// Encoded whole rather than character by character: one call, obviously
// correct, and it leaves the HTML escaper nothing to do, since the result
// holds no <, >, " or &. The '#' in each hex colour is the one that has to be
// encoded either way, because a raw one makes the browser read the rest of the
// URI as a fragment and the icon fails silently.
export const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(SVG)}`;
