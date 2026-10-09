import { SUBJECTS } from "../../../constants/subjects.js";
import { DIFFICULTY_LEVELS } from "../../../constants/questionDifficulty.js";
import { TEMPLATE_INFO } from "./schemaVersion.js";
import Grade from "../../../models/Grade.js";
import connectToDatabase from "../../../lib/connectToDb.js";

let gradesCache = null;
let gradesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getActiveGrades() {
  const now = Date.now();
  if (gradesCache && now - gradesCacheTime < CACHE_TTL) {
    return gradesCache;
  }
  await connectToDatabase();
  const grades = await Grade.find({ active: true }).select("name").lean();
  gradesCache = grades.map((g) => g.name);
  gradesCacheTime = Date.now();
  return gradesCache;
}

async function getDefaultGrade() {
  const grades = await getActiveGrades();
  return grades[1] ?? grades[0] ?? "الصف الأول الثانوي";
}

export async function createTemplateDefinition() {
  const defaultGrade = await getDefaultGrade();
  const DEFAULT_SUBJECT = SUBJECTS[2] ?? SUBJECTS[0];
  const DEFAULT_DIFFICULTY = "easy";

  return {
    schemaVersion: TEMPLATE_INFO.version,
    questions: [
      {
        type: "multiple-choice",
        questionText: "ما هو 2+2؟",
        difficulty: DEFAULT_DIFFICULTY,
        grade: defaultGrade,
        subject: DEFAULT_SUBJECT,
        tags: ["أساسيات", "جمع"],
        estimatedTime: 30,
        options: [
          { optionText: "3", valueText: "a" },
          { optionText: "4", valueText: "b" },
          { optionText: "5", valueText: "c" },
          { optionText: "6", valueText: "d" },
        ],
        correctAnswer: "b",
        image: {},
      },
      {
        type: "true-false",
        questionText: "الشمس نجم.",
        correctAnswer: "صح",
        difficulty: DEFAULT_DIFFICULTY,
        grade: defaultGrade,
        subject: DEFAULT_SUBJECT,
        tags: ["مراجعة", "الفصل الأول"],
      },
      {
        type: "essay",
        questionText: "اشرح عملية البناء الضوئي في النباتات.",
        correctAnswer: "النباتات تمتص ضوء الشمس بواسطة الكلوروفيل وتحول ثاني أكسيد الكربون والماء إلى جلوكوز وأكسجين.",
        difficulty: "medium",
        grade: defaultGrade,
        subject: DEFAULT_SUBJECT,
        tags: ["مراجعة"],
      },
      {
        type: "fill-blank",
        questionText: "عاصمة مصر هي ____.",
        correctAnswer: "القاهرة",
        options: [
          { id: "fb1", text: "القاهرة", isCorrect: true },
          { id: "fb2", text: "Cairo", isCorrect: false },
          { id: "fb3", text: "مدينة القاهرة", isCorrect: false },
        ],
        config: { caseSensitive: false },
        difficulty: DEFAULT_DIFFICULTY,
        grade: defaultGrade,
        subject: DEFAULT_SUBJECT,
        tags: ["جغرافيا"],
      },
      {
        type: "matching",
        questionText: "صل بين الدولة وعاصمتها.",
        correctAnswer: "",
        config: {
          pairs: [
            { id: "p1", leftItem: "فرنسا", rightItem: "باريس" },
            { id: "p2", leftItem: "ألمانيا", rightItem: "برلين" },
            { id: "p3", leftItem: "إسبانيا", rightItem: "مدريد" },
            { id: "p4", leftItem: "إيطاليا", rightItem: "روما" },
          ],
        },
        difficulty: "medium",
        grade: defaultGrade,
        subject: DEFAULT_SUBJECT,
        tags: ["عواصم", "جغرافيا"],
      },
      {
        type: "image-choice",
        questionText: "أي صورة تمثل تفاحة؟",
        correctAnswer: "a",
        options: [
          { optionText: "تفاحة", valueText: "a", image: { url: "https://example.com/apple.jpg", cloudId: "examples/apple" } },
          { optionText: "برتقالة", valueText: "b", image: { url: "https://example.com/orange.jpg", cloudId: "examples/orange" } },
        ],
      },
    ],
    defaults: {
      grade: defaultGrade,
      subject: DEFAULT_SUBJECT,
      difficulty: DEFAULT_DIFFICULTY,
      tags: ["مراجعة", "الفصل الأول"],
    },
    _meta: {
      title: "Repository Import Template",
      titleAr: "قالب استيراد الأسئلة",
      schemaVersion: TEMPLATE_INFO.version,
    },
  };
}
