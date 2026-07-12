// Regenera todo lo derivado de la marca a partir de src/lib/brand.json:
//   - bloque BRAND:START…BRAND:END de src/app/globals.css (tokens @theme)
//   - public/manifest.webmanifest y public/admin.webmanifest
//   - iconos PWA (public/icons/*.png) con sharp
//
// Rebrand del cliente = editar brand.json (+ opcional logo.svg) y correr:
//   node scripts/brand.mjs
// Si existe public/icons/logo.svg se usa como arte del icono; si no, se genera
// un monograma con shortName sobre themeColor.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const brand = JSON.parse(readFileSync(path.join(root, "src/lib/brand.json"), "utf8"));

// 1) Tokens @theme en globals.css
const cssPath = path.join(root, "src/app/globals.css");
const css = readFileSync(cssPath, "utf8");
const lines = [];
for (const [shade, value] of Object.entries(brand.primary)) {
  lines.push(`  --color-primary-${shade}: ${value};`);
}
for (const [shade, value] of Object.entries(brand.accent)) {
  lines.push(`  --color-accent-${shade}: ${value};`);
}
const block = `/* BRAND:START — bloque generado por scripts/brand.mjs desde src/lib/brand.json.
     No editar a mano: correr \`node scripts/brand.mjs\` tras cambiar brand.json. */
${lines.join("\n")}
  /* BRAND:END */`;
const replaced = css.replace(/\/\* BRAND:START[\s\S]*?BRAND:END \*\//, block);
if (!replaced.includes("BRAND:START")) {
  console.error("✖ No se encontró el bloque BRAND:START…BRAND:END en globals.css");
  process.exit(1);
}
writeFileSync(cssPath, replaced);
console.log("✔ globals.css");

// 2) Manifests
function writeManifest(file, patch) {
  const p = path.join(root, "public", file);
  const m = JSON.parse(readFileSync(p, "utf8"));
  Object.assign(m, patch);
  writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
  console.log(`✔ ${file}`);
}
writeManifest("manifest.webmanifest", {
  name: brand.name,
  short_name: brand.clientAppName,
  description: brand.description,
  background_color: brand.backgroundColor,
  theme_color: brand.themeColor,
});
writeManifest("admin.webmanifest", {
  name: `${brand.shortName} Panel del Taller`,
  short_name: brand.adminAppName,
  description: brand.adminDescription,
  background_color: brand.adminBackgroundColor,
  theme_color: brand.adminThemeColor,
});

// 3) Iconos PWA
const logoPath = path.join(root, "public/icons/logo.svg");
const hasLogo = existsSync(logoPath);

function iconSvg(size, { maskable = false } = {}) {
  // Con logo: se centra al 62% del lienzo. Sin logo: monograma con shortName.
  const pad = maskable ? size * 0.19 : size * 0.12; // zona segura maskable
  const inner = size - pad * 2;
  const art = hasLogo
    ? `<image href="data:image/svg+xml;base64,${readFileSync(logoPath).toString("base64")}"
         x="${pad}" y="${pad}" width="${inner}" height="${inner}"/>`
    : `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
         font-family="Arial Narrow, Arial, sans-serif" font-weight="700"
         font-size="${inner * 0.42}" fill="#ffffff">${brand.shortName}</text>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="100%" height="100%" rx="${maskable ? 0 : size * 0.18}" fill="${brand.iconColor ?? brand.themeColor}"/>
       ${art}
     </svg>`
  );
}

for (const [file, size, opts] of [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-maskable-512.png", 512, { maskable: true }],
]) {
  await sharp(iconSvg(size, opts)).png().toFile(path.join(root, "public/icons", file));
  console.log(`✔ icons/${file}`);
}

// 4) Título por defecto del push en el service worker + bump de caché
const swPath = path.join(root, "public/sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw.replace(/title: "[^"]*", body: "Hay novedades/, `title: "${brand.name}", body: "Hay novedades`);
sw = sw.replace(/const VERSION = "sm96-v(\d+)";/, (_, n) => `const VERSION = "sm96-v${Number(n) + 1}";`);
writeFileSync(swPath, sw);
console.log("✔ sw.js (título push + versión de caché)");

console.log("Listo.");
