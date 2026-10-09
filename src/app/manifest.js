export default function manifest() {
  return {
    name: "أ. أحمد الدسوقي — منصة الكيمياء",
    short_name: "الدسوقي كيمياء",
    description:
      "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#F1F7F6",
    theme_color: "#073B40",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
