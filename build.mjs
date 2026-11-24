import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "iife",
  globalName: "VinylApp",
  loader: { ".css": "text" },
  minify: true,
  target: "es2022",
  outfile: "dist/index.js",
  // Spicetify calls a top-level render() that must return a React element.
  footer: { js: "function render(){return VinylApp.render();}" },
});

// The VinylGlass theme script (window backdrop from the current cover).
await build({
  entryPoints: ["src/theme.ts"],
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2022",
  outfile: "dist/theme.js",
});

console.log("built dist/index.js and dist/theme.js");
