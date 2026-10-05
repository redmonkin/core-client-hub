import { useEffect, useRef, type CSSProperties } from "react";
import { CheckCircle2, FileSignature, IndianRupee, LayoutDashboard, Lock, FileText, Users, Clock, ReceiptIndianRupee } from "lucide-react";
import clientraLogoDark from "@/assets/clientra-dark.svg";

const BASE_TILT = { x: 10, y: -16 };

const stats = [
  { label: "Active clients", value: "24", trend: "+3 this month" },
  { label: "Open proposals", value: "6", trend: "2 viewed today" },
  { label: "Outstanding", value: "₹1,84,500", trend: "4 invoices" },
];

const bars = [38, 56, 44, 72, 60, 84, 68];

const activity = [
  { icon: FileText, text: "Website redesign proposal viewed", time: "2m" },
  { icon: FileSignature, text: "Retainer contract sent for signature", time: "1h" },
  { icon: ReceiptIndianRupee, text: "Invoice INV-0042 paid", time: "3h" },
];

const nav = [LayoutDashboard, Users, FileText, FileSignature, ReceiptIndianRupee, Clock];

/**
 * A decorative, CSS-only 3D preview of the app for the landing hero. It tilts
 * toward the pointer on devices with a fine pointer, and stays still when the
 * visitor prefers reduced motion. No WebGL, so it costs nothing to load.
 */
export function HeroScene() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (still || !finePointer) return;

    let frame = 0;
    const target = { x: BASE_TILT.x, y: BASE_TILT.y };
    const current = { ...target };

    const tick = () => {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      stage.style.setProperty("--rx", `${current.x.toFixed(2)}deg`);
      stage.style.setProperty("--ry", `${current.y.toFixed(2)}deg`);
      if (Math.abs(target.x - current.x) > 0.01 || Math.abs(target.y - current.y) > 0.01) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onMove = (event: PointerEvent) => {
      const px = event.clientX / window.innerWidth - 0.5;
      const py = event.clientY / window.innerHeight - 0.5;
      target.x = BASE_TILT.x - py * 10;
      target.y = BASE_TILT.y + px * 18;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="motion-decor relative mx-auto w-full max-w-[600px] select-none [perspective:1600px]">
      <div
        ref={stageRef}
        className="preserve-3d relative [--rx:8deg] [--ry:-8deg] sm:[--rx:10deg] sm:[--ry:-16deg]"
        style={{
          transform: "rotateX(var(--rx, 10deg)) rotateY(var(--ry, -16deg))",
        }}
      >
        {/* App window */}
        <div className="preserve-3d relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_80px_-30px_hsl(200_98%_25%/0.45)]">
          <div className="flex items-center gap-1.5 border-b border-border bg-background/80 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 hidden h-5 flex-1 items-center rounded-md bg-muted px-2 text-[10px] text-muted-foreground sm:flex">
              <Lock className="mr-1 h-2.5 w-2.5" /> your-workspace / dashboard
            </span>
          </div>
          <div className="flex">
            <div className="hidden w-12 flex-col items-center gap-3 border-r border-border bg-background/60 py-4 sm:flex">
              <img src={clientraLogoDark} alt="" className="mb-1 h-6 w-6" />
              {nav.map((Icon, i) => (
                <span
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Good morning</p>
                <p className="text-sm font-semibold text-foreground">Here's your studio today</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border bg-background p-2">
                    <p className="truncate text-[9px] text-muted-foreground sm:text-[10px]">{stat.label}</p>
                    <p className="truncate text-xs font-bold text-foreground sm:text-sm">{stat.value}</p>
                    <p className="truncate text-[8px] text-primary sm:text-[9px]">{stat.trend}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-3 rounded-lg border border-border bg-background p-2">
                  <p className="mb-2 text-[10px] font-medium text-foreground">Revenue</p>
                  <div className="flex h-16 items-end gap-1.5 sm:h-20">
                    {bars.map((height, i) => (
                      <span
                        key={i}
                        className="flex-1 origin-bottom rounded-sm bg-gradient-to-t from-primary/70 to-primary animate-fade-up"
                        style={{ height: `${height}%`, animationDelay: `${300 + i * 80}ms` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5 rounded-lg border border-border bg-background p-2">
                  <p className="text-[10px] font-medium text-foreground">Activity</p>
                  {activity.map((item) => (
                    <div key={item.text} className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <item.icon className="h-2.5 w-2.5" />
                      </span>
                      <span className="truncate text-[9px] text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating cards, lifted off the window in 3D */}
        <div
          className="absolute -right-1 -top-8 animate-float sm:-right-8 sm:-top-6"
          style={{ "--z": "90px" } as CSSProperties}
        >
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-pulse-ring" />
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold text-foreground">Proposal approved</p>
              <p className="text-[9px] text-muted-foreground">Acme Studio · just now</p>
            </div>
          </div>
        </div>

        <div
          className="absolute -bottom-10 left-1 animate-float-slow sm:-bottom-8 sm:-left-10"
          style={{ "--z": "120px", animationDelay: "-3s" } as CSSProperties}
        >
          <div className="w-40 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:w-44">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <FileSignature className="h-3 w-3 text-primary" /> Contract signed
            </div>
            <p className="font-serif text-lg italic leading-tight text-foreground">Priya Sharma</p>
            <div className="mt-1 h-px bg-border" />
            <p className="mt-1 text-[9px] text-muted-foreground">Signed online · 05 Oct</p>
          </div>
        </div>

        <div
          className="absolute -bottom-6 right-1 animate-float sm:-bottom-5 sm:-right-4"
          style={{ "--z": "70px", animationDelay: "-1.5s" } as CSSProperties}
        >
          <div className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground shadow-xl shadow-primary/30">
            <IndianRupee className="h-4 w-4" />
            <div>
              <p className="text-[11px] font-semibold">₹48,000 received</p>
              <p className="text-[9px] opacity-80">Invoice INV-0042</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
