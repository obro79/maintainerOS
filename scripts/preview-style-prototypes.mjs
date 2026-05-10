import http from "node:http";

const port = Number(process.env.PORT || "3000");

const routes = {
  "/calm-operator": page("calm", "Backlog Router", "A command-center map, not a project board.", calmOperator()),
  "/dark-validation-layer": page("dark", "Verification Ledger", "A proof surface for code, review, and payment gates.", darkLedger()),
  "/neon-brutalist": page("neon", "Route Override Deck", "A loud demo surface built around maintainer control.", neonDeck()),
  "/frosted-ops-glass": page("frost", "Triage Cockpit", "A layered control room for scanning route decisions.", frostedCockpit()),
  "/github-native-utility": page("github", "GitHub Augmented", "GitHub issues with execution intelligence, not a clone.", githubAugmented())
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);
  if (url.pathname === "/") return send(response, index());
  if (routes[url.pathname]) return send(response, routes[url.pathname]);
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`MaintainerOS style previews running at http://localhost:${port}`);
});

function send(response, body) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function index() {
  return shell(
    "index",
    "MaintainerOS Style Prototypes",
    `<main class="index">
      <p class="kicker">MaintainerOS visual exploration</p>
      <h1>Five interface concepts for the routing board.</h1>
      <p class="lead">These are intentionally different product surfaces. Pick direction, not details.</p>
      <nav class="indexGrid">
        ${Object.entries(routes)
          .map(([path]) => `<a href="${path}"><b>${path.slice(1).replaceAll("-", " ")}</b><span>Open prototype</span></a>`)
          .join("")}
      </nav>
    </main>`
  );
}

function page(theme, title, subtitle, content) {
  return shell(
    theme,
    title,
    `<main class="frame">
      <header class="mast">
        <div>
          <p class="kicker">obro79 / maintaineros-demo-ledgerkit · 100 imported</p>
          <h1>${title}</h1>
          <p class="lead">${subtitle}</p>
        </div>
        <div class="statusRail"><span>GitHub</span><span>Neon</span><span>CLOD</span><span>Greptile</span><span>AllScale</span></div>
      </header>
      ${content}
    </main>`
  );
}

function calmOperator() {
  return `<section class="operator">
    <aside class="summary">
      <div><span>Total</span><b>100</b><small>open issues</small></div>
      <div><span>Autonomous</span><b>43</b><small>safe for agent</small></div>
      <div><span>Human</span><b>28</b><small>needs judgment</small></div>
      <div><span>Paid</span><b>12</b><small>bounty candidates</small></div>
    </aside>
    <section class="map">
      <div class="node source">GitHub backlog</div>
      <div class="split">
        <div class="lane agent"><b>Agent lane</b><span>#41 cache invalidation</span><small>Work order ready · PR pending</small></div>
        <div class="lane human"><b>Maintainer lane</b><span>#52 auth boundary</span><small>Decision brief ready</small></div>
        <div class="lane bounty"><b>Bounty lane</b><span>#77 adapter integration</span><small>$350 · AllScale release gated</small></div>
        <div class="lane clarify"><b>Clarify lane</b><span>#88 vague timeout</span><small>Draft response ready</small></div>
      </div>
      <div class="artifact">Selected route: CLOD rationale → work order → PR proof → verification → release gate</div>
    </section>
    <aside class="inspector">
      <p class="mini">Selected</p>
      <h2>#77 Implement adapter</h2>
      <dl><dt>Route</dt><dd>Bounty-worthy</dd><dt>Why</dt><dd>Bounded integration, clear tests, medium risk.</dd><dt>Gate</dt><dd>Release blocked until Greptile passes.</dd></dl>
      <button>Take back from bounty</button>
    </aside>
  </section>`;
}

function darkLedger() {
  const rows = [
    ["#41", "agent", "work order", "PR linked", "pending", "none"],
    ["#52", "maintainer", "brief", "blocked", "not required", "none"],
    ["#77", "bounty", "$350 funded", "PR merged", "passed", "ready"],
    ["#88", "clarify", "draft reply", "none", "not required", "none"]
  ];
  return `<section class="ledgerHero">
    <div class="proofScore"><span>Trust gates passed</span><b>31</b><small>work items have proof attached</small></div>
    <div class="proofScore warn"><span>Payout blocked</span><b>8</b><small>waiting on verification or maintainer acceptance</small></div>
    <div class="proofScore good"><span>Release ready</span><b>4</b><small>AllScale artifact can be released</small></div>
  </section>
  <section class="ledger">
    <div class="ledgerHead"><span>Issue</span><span>Route</span><span>Action</span><span>Code</span><span>Greptile</span><span>AllScale</span></div>
    ${rows.map((row) => `<div class="ledgerRow">${row.map((cell) => `<span>${cell}</span>`).join("")}</div>`).join("")}
  </section>`;
}

function neonDeck() {
  return `<section class="deck">
    <div class="deckCard big">
      <p>MAINTAINER OVERRIDE</p>
      <h2>Drag #77 from Bounty to Agent?</h2>
      <span>Blocked: risk score too high for autonomous execution.</span>
      <button>Force route anyway</button>
    </div>
    <div class="deckStack">
      ${["AGENT · 43", "MAINTAINER · 28", "BOUNTY · 12", "CLARIFY · 17"].map((label) => `<div class="slab">${label}</div>`).join("")}
    </div>
    <div class="deckCard">
      <p>NEXT DEMO BEAT</p>
      <h2>Greptile passed. AllScale release unblocked.</h2>
      <span>#77 adapter integration · $350</span>
    </div>
  </section>`;
}

function frostedCockpit() {
  return `<section class="cockpit">
    <div class="radar">
      <div class="ring r1">Agent 43</div>
      <div class="ring r2">Maintainer 28</div>
      <div class="ring r3">Bounty 12</div>
      <div class="ring r4">Clarify 17</div>
    </div>
    <div class="glassStack">
      <article><span>CLOD</span><b>Route confidence 86%</b><p>#41 is low-risk, bounded, and testable.</p></article>
      <article><span>Greptile</span><b>Verification pending</b><p>PR #9001 waiting for acceptance check scan.</p></article>
      <article><span>AllScale</span><b>Release gate locked</b><p>Payment appears only after merge + verification.</p></article>
    </div>
  </section>`;
}

function githubAugmented() {
  const rows = [
    ["#41", "Incorrect cache invalidation when webhook replay changes", "Agent", "Work order ready", "PR pending"],
    ["#52", "Review branch previews permissions after dependency upgrade", "Maintainer", "Decision needed", "No PR"],
    ["#77", "Implement schema migrations adapter with acceptance test suite", "Bounty", "$350 funded", "Release ready"],
    ["#88", "Clarify vague report about worker retries failures", "Clarify", "Draft reply", "No PR"]
  ];
  return `<section class="augmented">
    <aside>
      <button>All routed issues</button>
      <button>Agent-safe</button>
      <button>Maintainer decisions</button>
      <button>Bounty release gates</button>
    </aside>
    <div class="issuePane">
      ${rows
        .map(
          ([n, title, route, action, proof]) => `<article>
            <div><b>${title}</b><p>${n} · ${route} · ${action}</p></div>
            <span>${proof}</span>
          </article>`
        )
        .join("")}
    </div>
  </section>`;
}

function shell(theme, title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>${styles()}</style></head><body class="${theme}">${body}</body></html>`;
}

function styles() {
  return `
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;letter-spacing:0;background:var(--bg);color:var(--fg)}button{font:inherit}.frame{min-height:100vh;padding:32px;max-width:1480px;margin:0 auto}.mast{display:flex;justify-content:space-between;gap:32px;align-items:end;margin-bottom:24px}.kicker{margin:0 0 10px;color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}.mast h1,.index h1{margin:0;font-size:clamp(38px,5vw,76px);line-height:.94;letter-spacing:0}.lead{color:var(--muted);max-width:680px;font-size:16px}.statusRail{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.statusRail span{border:1px solid var(--border);background:var(--panel);padding:8px 10px;border-radius:999px;color:var(--muted);font-size:12px}.operator{display:grid;grid-template-columns:220px minmax(0,1fr)340px;gap:16px}.summary,.inspector,.map,.ledger,.proofScore,.deckCard,.radar,.glassStack article,.augmented aside,.issuePane{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius)}.summary{padding:12px;display:grid;gap:10px}.summary div{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px}.summary span,.summary small,.mini{display:block;color:var(--muted);font-size:12px}.summary b{display:block;font-size:34px;margin:4px 0}.map{padding:18px}.node,.artifact{border:1px solid var(--border);background:var(--card);border-radius:var(--radius);padding:16px;text-align:center;font-weight:800}.split{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.lane{min-height:300px;border:1px solid var(--border);border-radius:var(--radius);padding:14px;background:var(--card)}.lane b,.lane span,.lane small{display:block}.lane span{margin-top:80px;font-weight:800}.lane small{color:var(--muted);margin-top:10px}.inspector{padding:18px}.inspector h2{font-size:30px;line-height:1;margin:0 0 18px}.inspector dl{display:grid;grid-template-columns:70px 1fr;gap:12px;font-size:14px}.inspector dt{color:var(--muted)}.inspector button,.deck button,.augmented button{border:1px solid var(--border);background:var(--button);color:var(--buttonText);border-radius:var(--buttonRadius);height:42px;padding:0 14px;font-weight:800}.ledgerHero{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px}.proofScore{padding:18px}.proofScore span{color:var(--muted);font-size:13px}.proofScore b{display:block;font-size:54px}.ledger{overflow:hidden}.ledgerHead,.ledgerRow{display:grid;grid-template-columns:90px 1fr 160px 160px 160px 160px;gap:12px;padding:15px 18px;border-bottom:1px solid var(--border)}.ledgerHead{color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase}.deck{display:grid;grid-template-columns:1.2fr 320px 1fr;gap:18px}.deckCard{padding:24px;min-height:360px}.deckCard.big h2{font-size:54px}.deckCard p{font-weight:900;color:var(--accent)}.deckCard span{display:block;color:var(--muted);margin:14px 0}.deckStack{display:grid;gap:12px}.slab{background:var(--panel);border:3px solid var(--border);box-shadow:8px 8px 0 var(--shadow);padding:24px;font-size:28px;font-weight:950}.cockpit{display:grid;grid-template-columns:minmax(0,1fr)420px;gap:20px}.radar{min-height:560px;position:relative;overflow:hidden}.ring{position:absolute;border:1px solid var(--border);border-radius:999px;display:grid;place-items:center;background:var(--card);font-weight:900}.r1{inset:60px}.r2{inset:130px}.r3{inset:200px}.r4{inset:270px}.glassStack{display:grid;gap:14px}.glassStack article{padding:20px;backdrop-filter:blur(18px)}.glassStack span{color:var(--accent);font-size:12px;font-weight:900}.glassStack b{display:block;margin:8px 0;font-size:22px}.glassStack p{color:var(--muted)}.augmented{display:grid;grid-template-columns:260px 1fr;gap:16px}.augmented aside{padding:12px;display:grid;gap:8px;align-content:start}.augmented button{background:var(--card);color:var(--fg);text-align:left}.issuePane{overflow:hidden}.issuePane article{display:flex;justify-content:space-between;gap:20px;padding:18px;border-bottom:1px solid var(--border)}.issuePane p{color:var(--muted);margin:7px 0 0}.issuePane span{color:var(--accent);font-weight:800}.index{min-height:100vh;max-width:1100px;margin:0 auto;padding:44px}.indexGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:24px}.indexGrid a{display:block;background:#fff;border:1px solid #d8dee8;border-radius:14px;padding:20px;color:#14171f;text-decoration:none}.indexGrid span{display:block;color:#687385;margin-top:8px}
.calm{--bg:#f5f6f8;--fg:#111318;--muted:#667085;--panel:#fff;--card:#f9fafb;--border:#d7dde7;--accent:#0f766e;--button:#111318;--buttonText:#fff;--buttonRadius:8px;--radius:10px}
.dark{--bg:#06080d;--fg:#edf6ff;--muted:#91a1b8;--panel:#101722;--card:#0a1018;--border:#263244;--accent:#31d18b;--button:#31d18b;--buttonText:#07100c;--buttonRadius:8px;--radius:10px}
.neon{--bg:#08060c;--fg:#eaffdf;--muted:#a6c39e;--panel:#121019;--card:#08060c;--border:#8cff3a;--accent:#d83dff;--button:#8cff3a;--buttonText:#08060c;--buttonRadius:0;--radius:0;--shadow:#d83dff}
.frost{--bg:#091526;--fg:#eff7ff;--muted:#abc0dc;--panel:rgba(20,34,58,.66);--card:rgba(255,255,255,.07);--border:rgba(226,232,240,.18);--accent:#22d3ee;--button:#22d3ee;--buttonText:#071321;--buttonRadius:12px;--radius:18px;background:radial-gradient(circle at 20% 0,rgba(34,211,238,.24),transparent 34rem),radial-gradient(circle at 90% 80%,rgba(129,140,248,.20),transparent 34rem),var(--bg)}
.github{--bg:#fff;--fg:#24292f;--muted:#57606a;--panel:#fff;--card:#f6f8fa;--border:#d0d7de;--accent:#1f883d;--button:#1f883d;--buttonText:#fff;--buttonRadius:6px;--radius:8px}
@media(max-width:980px){.operator,.deck,.cockpit,.augmented{grid-template-columns:1fr}.split,.ledgerHero{grid-template-columns:1fr 1fr}.ledgerHead,.ledgerRow{grid-template-columns:80px 1fr 120px}.ledgerHead span:nth-child(n+4),.ledgerRow span:nth-child(n+4){display:none}}@media(max-width:640px){.frame{padding:18px}.mast{display:block}.split,.ledgerHero,.indexGrid{grid-template-columns:1fr}.statusRail{justify-content:flex-start}.issuePane article{display:block}}
`;
}
