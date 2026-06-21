"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function LandingPage() {
  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    const cleanups: Array<() => void> = [];

    // === REVEAL ON SCROLL + chart bars ===
    const targets = Array.prototype.slice.call(
      document.querySelectorAll(".reveal, #payoutChart")
    ) as Element[];

    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
      );
      targets.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    // === SCROLL-SPY: highlight active fore-edge tab + nav link ===
    if ("IntersectionObserver" in window) {
      const map: Record<string, string> = {
        top: "top",
        problem: "problem",
        solution: "problem",
        how: "how",
        why: "why",
        compare: "why",
        sides: "start",
        start: "start",
      };
      const tabs = Array.prototype.slice.call(
        document.querySelectorAll(".tabs a")
      ) as Element[];
      const links = Array.prototype.slice.call(
        document.querySelectorAll(".navlinks a:not(.btn)")
      ) as Element[];
      const sections = Array.prototype.slice.call(
        document.querySelectorAll("section[id]")
      ) as Element[];

      const setActive = (id: string) => {
        const tabId = map[id] || id;
        tabs.forEach((t) =>
          t.classList.toggle("on", t.getAttribute("data-tab") === tabId)
        );
        links.forEach((l) => {
          const href = (l.getAttribute("href") || "").replace("#", "");
          l.classList.toggle("on", href === id);
        });
      };

      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(e.target.id);
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );
      sections.forEach((s) => spy.observe(s));
      cleanups.push(() => spy.disconnect());
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;0,14..32,900;1,14..32,400;1,14..32,500&display=swap');

:root{
  --bg-outer:#2d2d2d;
  --bg-page:#f8f6f1;
  --text-primary:#1a1a1a;
  --text-secondary:#6b6358;
  --rule:#d8d2c4;
  --tab-1:#98d4bb;
  --tab-2:#c7b8ea;
  --tab-3:#f4b8c5;
  --tab-4:#a8d8ea;
  --tab-5:#ffe6a7;

  --font-display:'Inter','Helvetica Neue',system-ui,sans-serif;
  --font-body:'Inter','Helvetica Neue',system-ui,sans-serif;

  --ease:cubic-bezier(0.16,1,0.3,1);

  --maxw:1180px;
  --spine:96px;
}

*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:var(--bg-outer);
  color:var(--text-primary);
  font-family:var(--font-body);
  font-size:18px;line-height:1.6;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  background-image:
    radial-gradient(1200px 700px at 50% -10%, rgba(255,255,255,0.05), transparent 70%),
    radial-gradient(900px 600px at 50% 120%, rgba(0,0,0,0.35), transparent 70%);
  background-attachment:fixed;
}
::selection{background:var(--tab-2);color:var(--text-primary)}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}

.desk{padding:48px clamp(16px,4vw,72px) 64px}
.notebook{
  position:relative;
  max-width:var(--maxw);
  margin:0 auto;
  background:var(--bg-page);
  border-radius:10px;
  box-shadow:
    0 2px 4px rgba(0,0,0,0.18),
    0 28px 70px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,255,255,0.7);
  background-image:repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 43px,
    rgba(108,99,88,0.06) 43px,
    rgba(108,99,88,0.06) 44px);
  overflow:hidden;
}

.spine{
  position:absolute;left:0;top:0;bottom:0;width:var(--spine);
  pointer-events:none;z-index:3;
}
.spine .holes{
  position:absolute;left:34px;top:0;bottom:0;width:26px;
  background-image:radial-gradient(circle at 13px 13px,
      var(--bg-outer) 0 9px, rgba(0,0,0,0) 10px);
  background-size:26px 64px;
  background-repeat:repeat-y;
  box-shadow:none;
}
.spine .holes::after{
  content:"";position:absolute;inset:0;
  background-image:radial-gradient(circle at 13px 13px,
      rgba(0,0,0,0) 0 9px,
      rgba(0,0,0,0.28) 10px,
      rgba(0,0,0,0) 11px),
    radial-gradient(circle at 13px 15px,
      rgba(255,255,255,0.85) 9.5px,
      rgba(0,0,0,0) 10.5px);
  background-size:26px 64px;background-repeat:repeat-y;
  mix-blend-mode:normal;opacity:.5;
}
.spine .margin-rule{
  position:absolute;left:var(--spine);top:0;bottom:0;width:1px;
  margin-left:-4px;background:var(--tab-3);opacity:.55;
}

.page{padding:0 clamp(20px,5vw,72px) 0 calc(var(--spine) + 28px)}

.masthead{
  position:sticky;top:0;z-index:20;
  display:flex;align-items:center;justify-content:space-between;
  gap:24px;
  padding:18px clamp(20px,5vw,72px) 18px calc(var(--spine) + 28px);
  background:rgba(248,246,241,0.86);
  backdrop-filter:saturate(140%) blur(8px);
  -webkit-backdrop-filter:saturate(140%) blur(8px);
  border-bottom:1px solid var(--rule);
}
.brand{display:flex;align-items:baseline;gap:12px;font-family:var(--font-display)}
.brand .word{font-size:30px;font-weight:700;letter-spacing:.01em}
.brand .dot{width:9px;height:9px;border-radius:50%;background:var(--tab-1);
  display:inline-block;transform:translateY(-2px)}
.brand .tag{font-family:var(--font-body);font-size:12px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--text-secondary)}
.navlinks{display:flex;gap:28px;align-items:center}
.navlinks a{font-size:14px;font-weight:500;color:var(--text-secondary);
  letter-spacing:.01em;transition:color .2s var(--ease)}
.navlinks a:hover,.navlinks a.on{color:var(--text-primary)}
.navlinks .sep{width:1px;height:18px;background:var(--rule)}

.tabs{
  position:fixed;right:0;top:50%;transform:translateY(-50%);
  z-index:30;display:flex;flex-direction:column;gap:10px;
}
.tabs a{
  writing-mode:vertical-rl;
  font-family:var(--font-body);font-weight:700;font-size:13px;
  letter-spacing:.18em;text-transform:uppercase;color:var(--text-primary);
  width:42px;min-height:130px;
  display:flex;align-items:center;justify-content:center;
  border-radius:10px 0 0 10px;
  padding:14px 0;opacity:.82;
  transform:translateX(8px);
  box-shadow:-3px 4px 10px rgba(0,0,0,0.28);
  transition:transform .35s var(--ease),opacity .35s var(--ease),box-shadow .35s var(--ease);
}
.tabs a:nth-child(1){background:var(--tab-1)}
.tabs a:nth-child(2){background:var(--tab-2)}
.tabs a:nth-child(3){background:var(--tab-3)}
.tabs a:nth-child(4){background:var(--tab-4)}
.tabs a:nth-child(5){background:var(--tab-5)}
.tabs a:hover{transform:translateX(2px);opacity:1}
.tabs a.on{transform:translateX(0);opacity:1;box-shadow:-5px 6px 16px rgba(0,0,0,0.4)}

.btn{
  display:inline-flex;align-items:center;gap:9px;
  font-family:var(--font-body);font-weight:700;font-size:15px;
  letter-spacing:.01em;padding:14px 26px;border-radius:8px;cursor:pointer;
  border:1.5px solid var(--text-primary);
  transition:transform .25s var(--ease),background .25s var(--ease),color .25s var(--ease);
}
.btn .arr{transition:transform .25s var(--ease)}
.btn:hover .arr{transform:translateX(4px)}
.btn-primary{background:var(--text-primary);color:var(--bg-page)}
.btn-primary:hover{transform:translateY(-2px)}
.btn-ghost{background:transparent;color:var(--text-primary)}
.btn-ghost:hover{background:var(--text-primary);color:var(--bg-page);transform:translateY(-2px)}
.btn-sm{padding:10px 18px;font-size:14px}

section{scroll-margin-top:88px}
.sec{padding:84px 0;border-top:1px solid var(--rule)}
.sec:first-of-type{border-top:0}
.eyebrow{
  display:inline-flex;align-items:center;gap:10px;
  font-weight:700;font-size:13px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--text-secondary);margin-bottom:22px;
}
.eyebrow .chip{width:12px;height:12px;border-radius:3px;background:var(--tab-1)}
.secnum{
  font-family:var(--font-display);font-weight:900;font-size:clamp(72px,11vw,150px);
  line-height:.8;color:transparent;-webkit-text-stroke:2px var(--text-primary);
  letter-spacing:-.02em;
}
.secnum-bar{height:8px;width:120px;border-radius:4px;margin:14px 0 6px}
h2.title{
  font-family:var(--font-display);font-weight:700;
  font-size:clamp(34px,5.2vw,68px);line-height:1.04;letter-spacing:-.01em;
  max-width:18ch;text-wrap:balance;
}
h2.title em{font-style:italic;font-weight:400}
.lede{font-size:clamp(18px,2.1vw,23px);line-height:1.55;color:var(--text-secondary);
  max-width:60ch;margin-top:22px;text-wrap:pretty}

.hero{padding-top:64px;padding-bottom:96px}
.hero .kick{margin-bottom:26px}
.hero h1{
  font-family:var(--font-display);font-weight:700;
  font-size:clamp(48px,9vw,118px);line-height:.96;letter-spacing:-.02em;
  max-width:14ch;text-wrap:balance;
}
.hero h1 em{font-style:italic;font-weight:400}
.hero .lede{max-width:56ch;margin-top:32px;color:var(--text-secondary)}
.hero .actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:40px}
.meta-row{display:flex;flex-wrap:wrap;gap:10px 12px;margin-top:38px}
.meta{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;
  color:var(--text-secondary);border:1px solid var(--rule);border-radius:999px;
  padding:7px 14px;background:rgba(255,255,255,0.4)}
.meta .d{width:7px;height:7px;border-radius:50%}
.swatches{display:flex;gap:10px;margin-top:44px}
.swatches span{width:46px;height:30px;border-radius:6px;
  box-shadow:0 2px 6px rgba(0,0,0,0.12)}

.opts{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;margin-top:48px}
.opt{
  border:1px solid var(--rule);border-radius:12px;padding:28px 26px;
  background:rgba(255,255,255,0.45);position:relative;overflow:hidden;
}
.opt::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px}
.opt:nth-child(1)::before{background:var(--tab-2)}
.opt:nth-child(2)::before{background:var(--tab-3)}
.opt:nth-child(3)::before{background:var(--tab-4)}
.opt:nth-child(4)::before{background:var(--tab-5)}
.opt h3{font-family:var(--font-display);font-weight:700;font-size:25px;margin-bottom:10px}
.opt p{font-size:16px;color:var(--text-secondary);line-height:1.55}
.opt .verdict{display:inline-block;margin-top:14px;font-size:12px;font-weight:700;
  letter-spacing:.12em;text-transform:uppercase;color:#a4503f}
.punch{
  margin-top:46px;font-family:var(--font-display);font-style:italic;font-weight:400;
  font-size:clamp(26px,3.8vw,44px);line-height:1.25;max-width:24ch;text-wrap:balance;
}
.punch b{font-style:normal;font-weight:700;
  background:linear-gradient(transparent 62%, var(--tab-3) 62% 92%, transparent 92%);
  padding:0 .1em}

.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:52px}
.pillar{padding-top:26px;border-top:3px solid var(--text-primary)}
.pillar .icon{width:42px;height:42px;margin-bottom:18px}
.pillar h3{font-family:var(--font-display);font-weight:700;font-size:24px;margin-bottom:10px}
.pillar p{font-size:16px;color:var(--text-secondary);line-height:1.55}
.flowline{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:54px;
  padding:22px 24px;border:1px dashed var(--rule);border-radius:12px;
  background:rgba(255,255,255,0.4)}
.flowline .step{font-weight:700;font-size:15px}
.flowline .to{color:var(--text-secondary);font-family:var(--font-display);
  font-style:italic;font-size:20px}

.steps{margin-top:52px;display:grid;gap:2px;border:1px solid var(--rule);
  border-radius:14px;overflow:hidden;background:var(--rule)}
.step-row{display:grid;grid-template-columns:84px 56px 1fr;gap:24px;align-items:start;
  background:var(--bg-page);padding:30px 28px;transition:background .3s var(--ease)}
.step-row:hover{background:#fffdf8}
.step-row .n{font-family:var(--font-display);font-weight:900;font-size:54px;line-height:.8;
  color:transparent;-webkit-text-stroke:1.5px var(--text-primary)}
.step-row .ic{width:38px;height:38px;margin-top:4px}
.step-row h3{font-family:var(--font-display);font-weight:700;font-size:23px;margin-bottom:6px}
.step-row p{font-size:16px;color:var(--text-secondary);line-height:1.55;max-width:62ch}
.step-row p code{font-family:ui-monospace,'SF Mono',Menlo,monospace;background:var(--tab-5);
  border-radius:4px;padding:1px 6px;font-size:14px;font-weight:500;font-style:italic}

.payout{margin-top:54px;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
.chart{
  border:1px solid var(--rule);border-radius:14px;padding:30px 28px 24px;
  background:rgba(255,255,255,0.5);
}
.chart .bars{display:flex;align-items:flex-end;gap:14px;height:230px;
  border-bottom:2px solid var(--text-primary);padding-bottom:0}
.bar-wrap{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;
  text-align:center;gap:8px}
.bar{border-radius:6px 6px 0 0;transform-origin:bottom;transform:scaleY(0);
  transition:transform .9s var(--ease);min-height:6px}
.chart.in .bar{transform:scaleY(1)}
.bar-wrap:nth-child(1) .bar{background:var(--tab-1);transition-delay:.05s}
.bar-wrap:nth-child(2) .bar{background:var(--tab-2);transition-delay:.13s}
.bar-wrap:nth-child(3) .bar{background:var(--tab-3);transition-delay:.21s}
.bar-wrap:nth-child(4) .bar{background:var(--tab-4);transition-delay:.29s}
.bar-wrap:nth-child(5) .bar{background:var(--tab-5);transition-delay:.37s}
.bar-cap{font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--text-secondary)}
.chart .axis{display:flex;justify-content:space-between;margin-top:12px;
  font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-secondary)}
.payout .note{border-left:4px solid var(--tab-1);padding:6px 0 6px 22px}
.payout .note h3{font-family:var(--font-display);font-weight:700;font-size:28px;margin-bottom:14px;line-height:1.1}
.payout .note p{color:var(--text-secondary);font-size:17px;line-height:1.6}

.why{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:52px}
.why .card{position:relative;padding:28px 24px 30px;border-radius:12px;
  background:rgba(255,255,255,0.5);border:1px solid var(--rule)}
.why .card .tag{display:inline-block;font-weight:700;font-size:12px;letter-spacing:.14em;
  text-transform:uppercase;padding:5px 11px;border-radius:999px;margin-bottom:18px}
.why .card:nth-child(1) .tag{background:var(--tab-1)}
.why .card:nth-child(2) .tag{background:var(--tab-4)}
.why .card:nth-child(3) .tag{background:var(--tab-5)}
.why .card h3{font-family:var(--font-display);font-weight:700;font-size:23px;margin-bottom:10px}
.why .card p{font-size:16px;color:var(--text-secondary);line-height:1.55}

.cmp{margin-top:52px;overflow-x:auto}
table.compare{width:100%;border-collapse:collapse;min-width:680px;font-size:15px}
table.compare th,table.compare td{text-align:left;padding:18px 20px;border-bottom:1px solid var(--rule)}
table.compare thead th{font-size:12px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--text-secondary);font-weight:700}
table.compare tbody th{font-weight:700;font-family:var(--font-display);font-size:19px}
table.compare td{color:var(--text-secondary)}
table.compare .yes{color:var(--text-primary);font-weight:600}
table.compare tr.keel{position:relative}
table.compare tr.keel th,table.compare tr.keel td{
  background:var(--bg-page);box-shadow:8px 8px 0 var(--tab-4);
  border-bottom:2px solid var(--text-primary);border-top:2px solid var(--text-primary)}
table.compare tr.keel th{color:var(--text-primary)}
table.compare tr.keel td{color:var(--text-primary);font-weight:600}
table.compare tr.keel th:first-child{border-left:2px solid var(--text-primary)}
table.compare tr.keel td:last-child{border-right:2px solid var(--text-primary)}

.sides{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:52px}
.side{border:1px solid var(--rule);border-radius:14px;padding:34px 30px;
  background:rgba(255,255,255,0.5)}
.side .role{font-weight:700;font-size:12px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--text-secondary);margin-bottom:14px}
.side h3{font-family:var(--font-display);font-weight:700;font-size:30px;margin-bottom:14px;line-height:1.05}
.side p{color:var(--text-secondary);font-size:16px;line-height:1.6}
.side.lp{border-color:var(--text-primary);border-width:1.5px}
.flywheel{margin-top:42px;text-align:center;font-family:var(--font-display);
  font-style:italic;font-size:clamp(18px,2.4vw,26px);color:var(--text-secondary);
  line-height:1.5;text-wrap:balance;max-width:72ch;margin-left:auto;margin-right:auto}
.flywheel b{font-style:normal;font-weight:700;color:var(--text-primary)}

.closing{text-align:center;padding:96px 0 40px}
.closing .quote-mark{font-family:var(--font-display);font-size:200px;line-height:.5;
  color:var(--tab-2);height:90px;overflow:hidden;display:block}
.closing h2{font-family:var(--font-display);font-weight:700;
  font-size:clamp(40px,7vw,92px);line-height:1;letter-spacing:-.02em;margin:14px auto 0;
  max-width:16ch;text-wrap:balance}
.closing h2 em{font-style:italic;font-weight:400}
.closing .actions{display:flex;justify-content:center;flex-wrap:wrap;gap:16px;margin-top:44px}
.colophon{margin-top:64px;padding-top:28px;border-top:1px solid var(--rule);
  display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;
  font-size:13px;color:var(--text-secondary);letter-spacing:.02em}
.colophon .links{display:flex;gap:22px;flex-wrap:wrap}
.colophon a{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--rule)}
.colophon a:hover{text-decoration-color:var(--text-primary)}

.reveal{opacity:0;transform:translateY(22px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.reveal.in{opacity:1;transform:none}
.reveal.d1{transition-delay:.08s}.reveal.d2{transition-delay:.16s}
.reveal.d3{transition-delay:.24s}.reveal.d4{transition-delay:.32s}

@media (max-width:1080px){
  .tabs{display:none}
}
@media (max-width:880px){
  body{font-size:17px}
  :root{--spine:64px}
  .navlinks .desk-only{display:none}
  .opts{grid-template-columns:1fr}
  .pillars{grid-template-columns:1fr}
  .payout{grid-template-columns:1fr;gap:32px}
  .why{grid-template-columns:1fr}
  .sides{grid-template-columns:1fr}
  .step-row{grid-template-columns:56px 1fr;gap:18px}
  .step-row .ic{display:none}
}
@media (max-width:560px){
  .desk{padding:18px 12px 36px}
  .page{padding:0 20px 0 calc(var(--spine) + 14px)}
  .masthead{padding:14px 20px 14px calc(var(--spine) + 14px)}
  .brand .tag{display:none}
  .navlinks{gap:16px}
  .navlinks a{font-size:13px}
  .sec{padding:60px 0}
  .flowline .to{font-size:16px}
}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .reveal{opacity:1;transform:none;transition:none}
  .chart .bar{transform:scaleY(1);transition:none}
  .btn,.tabs a{transition:none}
}
`}</style>

      {/* === FORE-EDGE INDEX TABS (fixed right rail) === */}
      <nav className="tabs" aria-label="Section index">
        <a href="#top" data-tab="top">Cover</a>
        <a href="#problem" data-tab="problem">Problem</a>
        <a href="#how" data-tab="how">How it works</a>
        <a href="#why" data-tab="why">Why Keel</a>
        <a href="#start" data-tab="start">Get cover</a>
      </nav>

      <div className="desk">
        <div className="notebook">
          {/* binder spine */}
          <div className="spine" aria-hidden="true">
            <div className="holes"></div>
            <div className="margin-rule"></div>
          </div>

          {/* === STICKY HEADER === */}
          <header className="masthead">
            <a href="#top" className="brand" aria-label="Keel home">
              <span className="word">Keel</span>
              <span className="dot"></span>
              <span className="tag desk-only">Crash insurance</span>
            </a>
            <nav className="navlinks" aria-label="Primary">
              <Link href="/app" className="btn btn-primary btn-sm">
                Buy cover <span className="arr">→</span>
              </Link>
            </nav>
          </header>

          <main className="page">
            {/* ================= HERO ================= */}
            <section id="top" className="sec hero">
              <div className="kick eyebrow reveal">
                <span className="chip"></span>Parametric crash insurance · Built on Sui
              </div>
              <h1 className="reveal d1">
                Crash insurance for your crypto, paid <em>automatically</em>.
              </h1>
              <p className="lede reveal d2">
                Pick an asset you hold, choose how far down you want to be protected, and pay one
                premium. If it falls below your level, you&rsquo;re paid in proportion to the drop —
                no claim to file, no counterparty deciding whether you qualify.
              </p>
              <div className="actions reveal d3">
                <Link href="/app" className="btn btn-primary">
                  Buy cover <span className="arr">→</span>
                </Link>
                <Link href="/underwriter" className="btn btn-ghost">
                  Earn as an underwriter
                </Link>
              </div>
              <div className="meta-row reveal d3">
                <span className="meta">
                  <span className="d" style={{ background: "var(--tab-1)" }}></span>Built on DeepBook Predict · Sui
                </span>
                <span className="meta">
                  <span className="d" style={{ background: "var(--tab-4)" }}></span>Non-custodial
                </span>
                <span className="meta">
                  <span className="d" style={{ background: "var(--tab-3)" }}></span>No seed phrase · no gas · no claims
                </span>
              </div>
              <div className="swatches reveal d4" aria-hidden="true">
                <span style={{ background: "var(--tab-1)" }}></span>
                <span style={{ background: "var(--tab-2)" }}></span>
                <span style={{ background: "var(--tab-3)" }}></span>
                <span style={{ background: "var(--tab-4)" }}></span>
                <span style={{ background: "var(--tab-5)" }}></span>
              </div>
            </section>

            {/* ================= PROBLEM ================= */}
            <section id="problem" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-2)" }}></div>
              <h2 className="title reveal d1">
                Crypto is brutally volatile — yet holders have no simple way to hedge a crash.
              </h2>
              <p className="lede reveal d1">
                Every option today is built for traders and institutions, not for the person who just wants to keep what they hold.
              </p>

              <div className="opts">
                <div className="opt reveal d1">
                  <h3>CEX options</h3>
                  <p>Custodial, KYC-gated, and buried in complex Greeks. Not built for a normal holder.</p>
                  <span className="verdict">Too complex · custodial</span>
                </div>
                <div className="opt reveal d2">
                  <h3>Perps &amp; shorts</h3>
                  <p>Active management and liquidation risk. You can lose more than you put in.</p>
                  <span className="verdict">Liquidation risk</span>
                </div>
                <div className="opt reveal d2">
                  <h3>Sell and re-buy</h3>
                  <p>You miss the upside and pay the taxes and fees on the way out — and again on the way back.</p>
                  <span className="verdict">Miss the upside</span>
                </div>
                <div className="opt reveal d3">
                  <h3>On-chain &ldquo;insurance&rdquo;</h3>
                  <p>Nexus Mutual and its peers cover smart-contract failure — not a price crash.</p>
                  <span className="verdict">Wrong risk covered</span>
                </div>
              </div>

              <p className="punch reveal d2">
                So holders eat the volatility or panic-sell at the bottom. The #1 fear — <b>&ldquo;what if it dumps&rdquo;</b> — has no consumer product.
              </p>
            </section>

            {/* ================= SOLUTION ================= */}
            <section id="solution" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-1)" }}></div>
              <h2 className="title reveal d1">
                Keel is parametric crash insurance <em>for price.</em>
              </h2>
              <p className="lede reveal d1">
                It feels like buying travel insurance. Pick the asset, the protection level, and the
                term — then pay a premium in one tap. If the asset settles below your trigger at expiry,
                the payout lands in your account automatically. If nothing happens, your cover simply expires.
              </p>

              <div className="pillars">
                <div className="pillar reveal d1">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 17l5-6 4 4 6-9" />
                    <path d="M3 21h18" />
                  </svg>
                  <h3>Proportional payout</h3>
                  <p>The further it falls below your trigger, the more you&rsquo;re paid — up to your coverage. It mirrors your real loss, not a fixed lottery prize.</p>
                </div>
                <div className="pillar reveal d2">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l4 4 10-10" />
                    <circle cx="12" cy="12" r="9.5" opacity=".35" />
                  </svg>
                  <h3>No claims, ever</h3>
                  <p>No adjusters, no counterparty discretion. Settlement is on-chain and the payout is automatic the moment it triggers.</p>
                </div>
                <div className="pillar reveal d3">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6h16M4 12h10M4 18h7" />
                    <circle cx="18.5" cy="16.5" r="3" />
                    <path d="M18.5 14.8v1.7l1.1.7" />
                  </svg>
                  <h3>Consumer-grade onboarding</h3>
                  <p>Sign in with email or Google to get a non-custodial Sui wallet. No seed phrase, no gas to think about.</p>
                </div>
              </div>

              <div className="flowline reveal d2" role="list" aria-label="How a policy is bought">
                <span className="step" role="listitem">Pick your asset</span>
                <span className="to">→</span>
                <span className="step" role="listitem">Set protection level</span>
                <span className="to">→</span>
                <span className="step" role="listitem">Choose a term</span>
                <span className="to">→</span>
                <span className="step" role="listitem">Pay premium</span>
                <span className="to">→</span>
                <span className="step" role="listitem">Paid if it crashes</span>
              </div>
            </section>

            {/* ================= HOW IT WORKS ================= */}
            <section id="how" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-3)" }}></div>
              <h2 className="title reveal d1">How the magic works.</h2>
              <p className="lede reveal d1">Five moving parts. You only ever see the first three — the rest runs itself.</p>

              <div className="steps">
                <div className="step-row reveal d1">
                  <span className="n">1</span>
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                  <div>
                    <h3>Proof of exposure</h3>
                    <p>Keel reads what you actually hold, so you size cover to your real position — not a number you guessed.</p>
                  </div>
                </div>
                <div className="step-row reveal d1">
                  <span className="n">2</span>
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 19V5M4 19h16M8 17v-5M12 17V8M16 17v-3M20 17v-8" />
                  </svg>
                  <div>
                    <h3>Indemnity engine</h3>
                    <p>Your request — &ldquo;protect my BTC down to $56k&rdquo; — becomes a ladder of binary <code>BTC below $X</code> positions that approximates a linear loss curve. Every premium is priced live from DeepBook Predict, never invented by us.</p>
                  </div>
                </div>
                <div className="step-row reveal d1">
                  <span className="n">3</span>
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h3>One signature</h3>
                    <p>A single signature mints the whole ladder into your own on-chain account. (It creates your Keel account inline if you don&rsquo;t have one yet.)</p>
                  </div>
                </div>
                <div className="step-row reveal d2">
                  <span className="n">4</span>
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                  <div>
                    <h3>Automatic payout</h3>
                    <p>When the oracle settles, a permissionless keeper redeems the in-the-money positions and the payout lands in your account. You do nothing — &ldquo;you do nothing&rdquo; is literally true.</p>
                  </div>
                </div>
                <div className="step-row reveal d2">
                  <span className="n">5</span>
                  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 10l9-6 9 6" />
                    <path d="M5 9v10h14V9" />
                    <path d="M9 19v-6h6v6" />
                  </svg>
                  <div>
                    <h3>Underwriters back it</h3>
                    <p>A shared vault supplies the capital that backs your cover — and earns the premiums when crashes don&rsquo;t come.</p>
                  </div>
                </div>
              </div>

              {/* payout chart */}
              <div className="payout">
                <div className="chart reveal d1" id="payoutChart">
                  <div className="bars">
                    <div className="bar-wrap"><div className="bar" style={{ height: "18%" }}></div><span className="bar-cap">−2%</span></div>
                    <div className="bar-wrap"><div className="bar" style={{ height: "38%" }}></div><span className="bar-cap">−5%</span></div>
                    <div className="bar-wrap"><div className="bar" style={{ height: "58%" }}></div><span className="bar-cap">−9%</span></div>
                    <div className="bar-wrap"><div className="bar" style={{ height: "80%" }}></div><span className="bar-cap">−13%</span></div>
                    <div className="bar-wrap"><div className="bar" style={{ height: "100%" }}></div><span className="bar-cap">−17%</span></div>
                  </div>
                  <div className="axis"><span>Smaller dip</span><span>Payout · capped at coverage</span></div>
                </div>
                <div className="note reveal d2">
                  <h3>The deeper the crash, the larger the payout.</h3>
                  <p>A ladder of binary positions approximates your real loss curve, so a small dip pays a little and a deep crash pays a lot — up to the coverage you chose. A 4-day market, for example, can insure you down to roughly a 17% drop.</p>
                </div>
              </div>
            </section>

            {/* ================= WHY NOW ================= */}
            <section id="why" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-4)" }}></div>
              <h2 className="title reveal d1">Why this is possible now.</h2>
              <p className="lede reveal d1">Three things had to be true at once. They finally are.</p>

              <div className="why">
                <div className="card reveal d1">
                  <span className="tag">Liquidity arrived</span>
                  <h3>On-chain price markets</h3>
                  <p>DeepBook Predict brought deep, on-chain prediction-market liquidity to Sui. The rails for cheap, composable, permissionless price markets finally exist.</p>
                </div>
                <div className="card reveal d2">
                  <span className="tag">UX went mainstream</span>
                  <h3>Embedded wallets</h3>
                  <p>Privy made onboarding normal: email login, no seed phrase, account abstraction — crypto UX a regular person can actually use.</p>
                </div>
                <div className="card reveal d3">
                  <span className="tag">Fees fell</span>
                  <h3>Micro-policies are viable</h3>
                  <p>Sui&rsquo;s low fees mean you can insure $100, not just $100k. Crash protection finally makes sense for the everyday holder.</p>
                </div>
              </div>
            </section>

            {/* ================= COMPARISON ================= */}
            <section id="compare" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-5)" }}></div>
              <h2 className="title reveal d1">How Keel compares.</h2>
              <p className="lede reveal d1">The only option that covers a price crash, pays out automatically, and a normal person can use.</p>

              <div className="cmp reveal d1">
                <table className="compare">
                  <thead>
                    <tr>
                      <th scope="col">&nbsp;</th>
                      <th scope="col">Custody</th>
                      <th scope="col">Crash cover</th>
                      <th scope="col">Auto-payout</th>
                      <th scope="col">Consumer UX</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">CEX options</th>
                      <td>Custodial</td>
                      <td>Yes, complex</td>
                      <td>No — you exercise</td>
                      <td>Low</td>
                    </tr>
                    <tr>
                      <th scope="row">Perps / shorts</th>
                      <td>Mixed</td>
                      <td>Indirect</td>
                      <td>No — liquidation</td>
                      <td>Low</td>
                    </tr>
                    <tr>
                      <th scope="row">Nexus Mutual &amp; co.</th>
                      <td>Non-custodial</td>
                      <td>No — hacks only</td>
                      <td>Claims process</td>
                      <td>Medium</td>
                    </tr>
                    <tr className="keel">
                      <th scope="row">Keel</th>
                      <td className="yes">Non-custodial</td>
                      <td className="yes">Yes, proportional</td>
                      <td className="yes">Yes</td>
                      <td className="yes">High — no seed phrase</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ================= TWO SIDES / UNDERWRITERS ================= */}
            <section id="sides" className="sec">
              <div className="secnum-bar reveal" style={{ background: "var(--tab-1)" }}></div>
              <h2 className="title reveal d1">Two sides of the same vault.</h2>
              <p className="lede reveal d1">Buyers get protection. Underwriters supply the capital that backs it — and earn the premiums.</p>

              <div className="sides">
                <div className="side reveal d1">
                  <div className="role">For holders</div>
                  <h3>Insure what you hold</h3>
                  <p>One tap to protect a balance against a crash. Cover sized to your real position, premiums quoted live from the market, payout automatic if it triggers. Watch a live policy with a countdown to expiry, then get credited the moment it settles in the money.</p>
                </div>
                <div className="side lp reveal d2">
                  <div className="role">For underwriters</div>
                  <h3>Earn the premiums</h3>
                  <p>Supply liquidity to a shared vault that backs cover and collects the premiums when crashes don&rsquo;t come. Track your position, share-price PnL, vault utilization, and withdrawal headroom — and pull liquidity whenever there&rsquo;s room.</p>
                </div>
              </div>

              <p className="flywheel reveal d2">
                More buyers <b>→</b> more premium yield <b>→</b> more underwriter capital <b>→</b>
                deeper cover capacity <b>→</b> cheaper cover <b>→</b> more buyers.
              </p>
            </section>

            {/* ================= CLOSING CTA ================= */}
            <section id="start" className="sec closing">
              <span className="quote-mark" aria-hidden="true">&ldquo;</span>
              <h2 className="reveal">
                Keel keeps you upright in a <em>storm.</em>
              </h2>
              <div className="actions reveal d1">
                <Link href="/app" className="btn btn-primary">
                  Buy cover <span className="arr">→</span>
                </Link>
                <Link href="/underwriter" className="btn btn-ghost">
                  Earn as an underwriter
                </Link>
              </div>
              <div className="colophon">
                <span>Keel · Crash insurance for crypto · Non-custodial · No seed phrase</span>
                <span className="links">
                  <a href="#how">How it works</a>
                  <a href="#compare">Compare</a>
                  <a href="#sides">Underwrite</a>
                  <span>Built on DeepBook Predict · Sui</span>
                </span>
              </div>
            </section>
          </main>
        </div>
        {/* /notebook */}
      </div>
      {/* /desk */}
    </>
  );
}
