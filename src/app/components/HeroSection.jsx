import Link from "next/link";
import Image from "next/image";
import { LuArrowLeft, LuChevronDown } from "react-icons/lu";
import AtomOrbit from "./brand/AtomOrbit";
import LabGlassware from "./brand/LabGlassware";
import Reveal from "./ui/Reveal";
import checkUser from "../../../lib/checkUser";
import { withCaller, withTracePhase } from "../../../lib/trace/index.js";

export default async function HeroSection() {
  return withCaller("hero_section", () =>
    withTracePhase("rsc_render_component", async () => {
      const { success, user } = await checkUser();

      return (
        <section className="relative isolate overflow-hidden bg-[#073B40] text-white">
          {/* Mobile: portrait crop, framed on the teacher */}
          <Image
            src="/hero-mobile.png"
            alt="أ. أحمد الدسوقي — مدرس الكيمياء"
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover object-[50%_18%] lg:hidden"
          />
          {/* Desktop: landscape crop */}
          <Image
            src="/hero-desk.png"
            alt="أ. أحمد الدسوقي — مدرس الكيمياء"
            fill
            priority
            sizes="100vw"
            className="hidden -z-10 object-cover object-center lg:block"
          />
          {/* petrol atmosphere + readability scrim (vertical on mobile, horizontal on desktop) */}
          <div className="absolute inset-0 -z-10 " />
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="chem-pattern absolute inset-0 opacity-50" />
            <div className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-[#159A9C]/25 blur-3xl" />
            <div className="absolute -bottom-40 -right-16 h-[380px] w-[380px] rounded-full bg-[#FFB81C]/10 blur-3xl" />
            <span
              dir="ltr"
              className="absolute right-[6%] top-[18%] hidden select-none text-6xl font-black text-white/[0.07] lg:block"
            >
              H₂SO₄
            </span>
          </div>

          <div className="relative mx-auto flex min-h-[520px] max-w-7xl md:items-center items-end px-4 py-20 sm:min-h-[560px] sm:px-6 lg:min-h-[620px] lg:px-8 max-md:pb-4">
            <Reveal className="max-w-xl" y={18}>
              <h1 className="text-balance text-[34px] font-black leading-[1.35] text-white/90 sm:text-5xl lg:text-[56px]">
                الكيمياء مش حفظ معادلات...
                <span className="mt-1 block text-[#FFB81C]">
                  دي فهم وتفكير.
                </span>
              </h1>

              <p className="mt-6 text-2xl font-black text-white sm:text-3xl">
                أحمد الدسوقي
              </p>
              <p className="mt-1 text-sm font-bold text-white/70 sm:text-base">
                مدرس كيمياء في الإسماعيلية
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {user && success ? (
                  <Link
                    href={
                      user?.role === "admin"
                        ? "/dashboard/overview"
                        : "/userDashboard/overview"
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB81C] px-8 py-4 text-base font-extrabold text-[#3D2C00] shadow-xl transition-all hover:bg-[#E9A400] active:scale-[0.98]"
                  >
                    ادخل على لوحتك الدراسية
                    <span aria-hidden>
                      <LuArrowLeft size={18} />
                    </span>
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FFB81C] px-8 py-4 text-base font-extrabold text-[#3D2C00] shadow-xl transition-all hover:bg-[#E9A400] active:scale-[0.98]"
                  >
                    ابدأ الآن
                    <span aria-hidden>
                      <LuArrowLeft size={18} />
                    </span>
                  </Link>
                )}
              </div>
            </Reveal>

            {/* orbit mark + lab glassware */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-6 right-[-6%] hidden lg:block"
            >
              <AtomOrbit size={210} variant="dark" animated />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-16 left-[4%] hidden opacity-90 lg:block"
            >
              <LabGlassware size={230} variant="dark" animated />
            </div>

            {/* scroll cue */}
            <a
              href="#welcome"
              className="absolute bottom-6 left-4 hidden items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 backdrop-blur transition-colors hover:bg-white/15 hover:text-white sm:inline-flex lg:left-8"
            >
              اكتشف المنصة
              <LuChevronDown size={14} className="animate-bounce" />
            </a>
          </div>
        </section>
      );
    }),
  );
}