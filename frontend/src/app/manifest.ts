import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corralap · Presupuestos y seguimiento",
    short_name: "Corralap",
    description: "Presupuestos de materiales por obra y seguimiento de contratistas para corralones.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#16212b",
    theme_color: "#16212b",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuevo presupuesto", url: "/opportunities?nuevo=1" },
      { name: "Embudo de presupuestos", url: "/opportunities" },
    ],
  };
}
