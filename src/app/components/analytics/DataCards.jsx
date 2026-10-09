import { LuUsers, LuPlay, LuClipboardList, LuCheck, LuLayers } from "react-icons/lu";

const iconMap = {
  "Joined Users": <LuUsers size={18} />,
  "المستخدمون المنضمون": <LuUsers size={18} />,
  Grades: <LuLayers size={18} />,
  "الصفوف": <LuLayers size={18} />,
  Lectures: <LuPlay size={18} />,
  "المحاضرات": <LuPlay size={18} />,
  Exams: <LuClipboardList size={18} />,
  "الامتحانات": <LuClipboardList size={18} />,
  "Recorded Answers": <LuCheck size={18} />,
  "الإجابات المسجلة": <LuCheck size={18} />,
};

const titleMap = {
  "Joined Users": "المستخدمون المنضمون",
  Grades: "الصفوف",
  Lectures: "المحاضرات",
  Exams: "الامتحانات",
  "Recorded Answers": "الإجابات المسجلة",
};

export default function DataCards({ data }) {
  const icon = iconMap[data.title] || <LuLayers size={18} />;
  const title = titleMap[data.title] || data.title;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-(--brand-navy-border)">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-navy to-brand-teal opacity-90" />
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-brand-navy-soft opacity-60 blur-2xl group-hover:opacity-80 transition-opacity" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-text-muted">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black tracking-tight text-brand-navy">
            {data.count}
          </p>
          <div className="mt-2 h-1 w-12 rounded-full bg-brand-teal opacity-70" />
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy-soft text-brand-navy border border-(--brand-navy-border) shrink-0">
          {icon}
        </span>
      </div>
    </div>
  );
}
