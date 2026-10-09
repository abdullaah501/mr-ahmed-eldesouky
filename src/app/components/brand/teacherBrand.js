/**
 * المعرف المركزي لمنصة أ. أحمد الدسوقي — مدرس كيمياء
 * Single source of truth for teacher branding across the platform.
 * Use these constants instead of hardcoding the teacher name/subject/socials.
 */

export const TEACHER = {
  fullTitle: "أ. أحمد الدسوقي",
  shortName: "أحمد الدسوقي",
  subject: "الكيمياء",
  profession: "مدرس كيمياء",
  location: "الإسماعيلية، مصر",
  tagline: "اتعلّم الكيمياء بطريقة أبسط وأوضح",
  brandLine: "الكيمياء مش حفظ معادلات... دي فهم وتفكير.",
  description:
    "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
};

export const TEACHER_SOCIALS = {
  instagram: "https://www.instagram.com/eldesouky726",
  tiktok: "https://www.tiktok.com/@ahmed.eldesouky71",
  youtube: "https://youtube.com/@mr.ahmedeldesouky-bondinch1057",
  facebook: "https://www.facebook.com/Mr.DesoukyChemistry",
};

export const NAV_LINKS = [
  { label: "الرئيسية", href: "/" },
  { label: "الامتحانات", href: "/userDashboard/exams" },
  { label: "النتائج", href: "/userDashboard/overview" },
  { label: "المحتوى التعليمي", href: "/#grades" },
  { label: "عن الأستاذ", href: "/#teacher" },
  { label: "تواصل معنا", href: "/contact" },
];

export const FOOTER_LINKS = [
  { label: "الرئيسية", href: "/" },
  { label: "الكورسات", href: "/#grades" },
  { label: "الاختبارات", href: "/userDashboard/exams" },
  { label: "عن الأستاذ", href: "/#teacher" },
  { label: "تواصل معنا", href: "/contact" },
];

export const SITE_SEO = {
  title: "أ. أحمد الدسوقي | مدرس كيمياء",
  description:
    "منصة أ. أحمد الدسوقي التعليمية لتعلم الكيمياء من خلال الشرح والدروس والاختبارات والتدريبات والمراجعات.",
  siteName: "أ. أحمد الدسوقي — الكيمياء",
  locale: "ar_EG",
  language: "ar",
};
