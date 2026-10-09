import Link from "next/link";
import { LuFlaskConical, LuClock, LuArrowLeft } from "react-icons/lu";
import AtomOrbit from "../brand/AtomOrbit";

const LEVEL_RE = /(ثالثة|رابعة|خامسة|سادسة|ثانية|أولى|إعدادي|اعدادي|ثانوي)/;

function levelOf(name = "") {
  const match = LEVEL_RE.exec(name);
  return match ? match[1] : "الكيمياء";
}

/**
 * SubjectCard — dark "المواد الدراسية" card (reference style).
 * Renders a real grade from the student's enrolled grades.
 */
export default function SubjectCard({ grade }) {
  const name = grade?.name || "الكيمياء";

  return (
    <Link
      href={`/userDashboard/grades/${grade?.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-bl from-[#073B40] to-[#0B5155] p-5 text-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFB81C]"
    >
      <div className="chem-pattern pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -left-3 opacity-40 transition-transform duration-500 group-hover:scale-110"
      >
        <AtomOrbit size={80} variant="dark" animated={false} />
      </div>

      <div className="relative flex justify-center">
        <LuFlaskConical size={34} className="text-[#8FE3E4]" aria-hidden />
      </div>
      <h3 className="relative mt-4 line-clamp-2 text-center text-base font-black leading-snug">
        {name}
      </h3>
      <p className="relative mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-white/60">
        <LuClock size={12} aria-hidden />
        {levelOf(name)}
      </p>
      <div className="relative mt-4 flex items-center justify-between">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-full border border-white/25 text-white transition-colors group-hover:border-[#FFB81C] group-hover:bg-[#FFB81C] group-hover:text-[#3D2C00]"
        >
          <LuArrowLeft size={14} />
        </span>
      </div>
    </Link>
  );
}