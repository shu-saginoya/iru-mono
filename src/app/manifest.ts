import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IRU MONO",
    short_name: "IRU MONO",
    start_url: "/",
    display: "standalone",
    background_color: "#E66643",
    theme_color: "#E66643",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable.png",
        sizes: "432x432",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
