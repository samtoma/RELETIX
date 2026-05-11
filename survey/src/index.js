const QUESTIONS = {
  q1_overall_feeling: { type: "scale", min: 1, max: 5, required: true },
  q2_skipped_frequency: {
    type: "choice",
    required: true,
    options: ["Never", "Once", "2-3 times", "Most of them", "I've stopped attending"],
  },
  q3_reasons: {
    type: "multi",
    required: false,
    options: [
      "Bad timing / schedule conflict",
      "The meetings don't feel useful",
      "Too many meetings overall",
      "I feel disconnected from the team",
      "I'm overloaded with other work",
      "I'm not sure what's expected of me",
      "Personal reasons",
      "Other",
    ],
  },
  q4_product_rating: { type: "scale", min: 1, max: 5, required: true },
  q5_one_thing_to_change: { type: "text", required: true, maxLength: 2000 },
  q6_vision_clarity: { type: "scale", min: 1, max: 5, required: true },
  q7_belief_in_direction: {
    type: "choice",
    required: true,
    options: ["Yes, fully", "Mostly, but I have doubts", "Not really", "No", "I'd rather not say"],
  },
  q8_morale: { type: "scale", min: 1, max: 5, required: true },
  q9_what_would_bring_back: { type: "text", required: true, maxLength: 2000 },
  q10_holding_back: { type: "text", required: false, maxLength: 4000 },
  q11_contact: { type: "text", required: false, maxLength: 200 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && pathname === "/") return html(formPage(env));
    if (request.method === "GET" && pathname === "/thanks") return html(thanksPage());
    if (request.method === "POST" && pathname === "/submit") return handleSubmit(request, env);
    if (pathname === "/admin") return handleAdmin(url, env);
    if (pathname === "/admin/export.csv") return handleExport(url, env);
    if (pathname === "/health") return new Response("ok");

    return new Response("Not found", { status: 404 });
  },
};

async function handleSubmit(request, env) {
  const contentType = request.headers.get("content-type") || "";
  let form;
  if (contentType.includes("application/json")) {
    form = await request.json();
  } else {
    const fd = await request.formData();
    form = {};
    for (const key of Object.keys(QUESTIONS)) {
      if (QUESTIONS[key].type === "multi") {
        form[key] = fd.getAll(key);
      } else {
        form[key] = fd.get(key);
      }
    }
  }

  const errors = validate(form);
  if (errors.length) {
    return new Response(JSON.stringify({ errors }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const cleaned = {
    q1_overall_feeling: toInt(form.q1_overall_feeling),
    q2_skipped_frequency: toStr(form.q2_skipped_frequency),
    q3_reasons: Array.isArray(form.q3_reasons) ? form.q3_reasons.join("|") : toStr(form.q3_reasons),
    q4_product_rating: toInt(form.q4_product_rating),
    q5_one_thing_to_change: toStr(form.q5_one_thing_to_change),
    q6_vision_clarity: toInt(form.q6_vision_clarity),
    q7_belief_in_direction: toStr(form.q7_belief_in_direction),
    q8_morale: toInt(form.q8_morale),
    q9_what_would_bring_back: toStr(form.q9_what_would_bring_back),
    q10_holding_back: toStr(form.q10_holding_back),
    q11_contact: toStr(form.q11_contact),
  };

  await env.DB.prepare(
    `INSERT INTO responses (
      q1_overall_feeling, q2_skipped_frequency, q3_reasons, q4_product_rating,
      q5_one_thing_to_change, q6_vision_clarity, q7_belief_in_direction, q8_morale,
      q9_what_would_bring_back, q10_holding_back, q11_contact
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      cleaned.q1_overall_feeling,
      cleaned.q2_skipped_frequency,
      cleaned.q3_reasons,
      cleaned.q4_product_rating,
      cleaned.q5_one_thing_to_change,
      cleaned.q6_vision_clarity,
      cleaned.q7_belief_in_direction,
      cleaned.q8_morale,
      cleaned.q9_what_would_bring_back,
      cleaned.q10_holding_back,
      cleaned.q11_contact
    )
    .run();

  return Response.redirect(new URL("/thanks", request.url).toString(), 303);
}

function validate(form) {
  const errors = [];
  for (const [key, q] of Object.entries(QUESTIONS)) {
    const val = form[key];
    const empty =
      val === undefined ||
      val === null ||
      (typeof val === "string" && val.trim() === "") ||
      (Array.isArray(val) && val.length === 0);
    if (q.required && empty) errors.push(`${key} is required`);
    if (!empty && q.type === "scale") {
      const n = Number(val);
      if (!Number.isInteger(n) || n < q.min || n > q.max) errors.push(`${key} out of range`);
    }
    if (!empty && q.type === "text" && typeof val === "string" && val.length > q.maxLength) {
      errors.push(`${key} too long`);
    }
    if (!empty && q.type === "choice" && !q.options.includes(String(val))) {
      errors.push(`${key} invalid`);
    }
  }
  return errors;
}

const toInt = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
const toStr = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

async function handleAdmin(url, env) {
  const token = url.searchParams.get("token");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response("Unauthorized. Append ?token=YOUR_ADMIN_TOKEN to the URL.", {
      status: 401,
    });
  }

  const { results } = await env.DB.prepare(
    `SELECT * FROM responses ORDER BY submitted_at DESC`
  ).all();

  const stats = await computeStats(env);
  return html(adminPage(results, stats, token));
}

async function handleExport(url, env) {
  const token = url.searchParams.get("token");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM responses ORDER BY submitted_at ASC`
  ).all();
  const cols = [
    "id",
    "submitted_at",
    "q1_overall_feeling",
    "q2_skipped_frequency",
    "q3_reasons",
    "q4_product_rating",
    "q5_one_thing_to_change",
    "q6_vision_clarity",
    "q7_belief_in_direction",
    "q8_morale",
    "q9_what_would_bring_back",
    "q10_holding_back",
    "q11_contact",
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [cols.join(",")]
    .concat(results.map((r) => cols.map((c) => escape(r[c])).join(",")))
    .join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reletix-survey-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}

async function computeStats(env) {
  const { results: agg } = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       ROUND(AVG(q1_overall_feeling), 2) AS avg_overall,
       ROUND(AVG(q4_product_rating), 2) AS avg_product,
       ROUND(AVG(q6_vision_clarity), 2) AS avg_vision,
       ROUND(AVG(q8_morale), 2) AS avg_morale
     FROM responses`
  ).all();
  return agg[0] || {};
}

function html(body) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

const baseCSS = `
  :root {
    --bg: #0b0d12;
    --panel: #11141b;
    --panel-2: #161a23;
    --text: #e8ecf1;
    --muted: #8a93a6;
    --accent: #7c5cff;
    --accent-2: #00d4a0;
    --border: #232838;
    --danger: #ff5d6c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -200px, #1a1f33 0%, var(--bg) 60%);
    color: var(--text); min-height: 100vh; line-height: 1.5;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px 80px; }
  header { text-align: center; margin-bottom: 32px; }
  header h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; }
  header p { color: var(--muted); margin: 0; }
  .badge {
    display: inline-block; padding: 4px 10px; border-radius: 999px;
    background: rgba(124, 92, 255, 0.15); color: var(--accent);
    font-size: 12px; font-weight: 600; margin-bottom: 12px;
  }
  .intro {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px; margin-bottom: 24px;
  }
  .intro p { margin: 0; color: var(--muted); }
  .q {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px; margin-bottom: 16px;
  }
  .q label.title {
    display: block; font-weight: 600; margin-bottom: 4px; font-size: 16px;
  }
  .q .help { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
  .req { color: var(--accent); margin-left: 4px; }
  textarea, input[type=text] {
    width: 100%; background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    padding: 12px; font: inherit; resize: vertical;
  }
  textarea:focus, input[type=text]:focus {
    outline: none; border-color: var(--accent);
  }
  .scale {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px;
  }
  .scale label {
    display: flex; align-items: center; justify-content: center;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 0; cursor: pointer; font-weight: 600;
    transition: all 0.15s;
  }
  .scale input { display: none; }
  .scale input:checked + span { color: white; }
  .scale label:has(input:checked) {
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    border-color: transparent;
  }
  .scale label:hover { border-color: var(--accent); }
  .scale .ends {
    display: flex; justify-content: space-between;
    font-size: 12px; color: var(--muted); margin-top: 8px;
    grid-column: 1 / -1;
  }
  .choices { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .choices label {
    display: flex; align-items: center; gap: 10px; padding: 12px;
    background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 10px; cursor: pointer; transition: all 0.15s;
  }
  .choices label:hover { border-color: var(--accent); }
  .choices label:has(input:checked) {
    border-color: var(--accent); background: rgba(124, 92, 255, 0.1);
  }
  .choices input { accent-color: var(--accent); width: 18px; height: 18px; }
  button.submit {
    width: 100%; padding: 16px; border: none; border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: white; font-size: 16px; font-weight: 700; cursor: pointer;
    margin-top: 8px;
  }
  button.submit:hover { opacity: 0.92; }
  button.submit:disabled { opacity: 0.5; cursor: not-allowed; }
  .footer {
    text-align: center; color: var(--muted); font-size: 12px; margin-top: 24px;
  }
  .error {
    background: rgba(255, 93, 108, 0.1); border: 1px solid var(--danger);
    color: var(--danger); padding: 12px; border-radius: 10px; margin-bottom: 16px;
  }
  .progress-saved {
    color: var(--accent-2); font-size: 12px; text-align: center; margin-top: 12px;
    opacity: 0; transition: opacity 0.3s;
  }
  .progress-saved.show { opacity: 1; }
  @media (max-width: 480px) {
    header h1 { font-size: 22px; }
    .scale label { padding: 12px 0; font-size: 14px; }
  }
`;

function formPage(env) {
  const team = (env.TEAM_NAME || "Reletix").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${team} Team Pulse Check</title>
  <style>${baseCSS}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <span class="badge">Anonymous · 5 min</span>
      <h1>${team} Team Pulse Check</h1>
      <p>Your honest feedback shapes what we do next.</p>
    </header>

    <div class="intro">
      <p>
        This survey is <strong>completely anonymous</strong> — no names, no emails, no IPs stored.
        We've noticed lower attendance lately and we want to understand what's really going on so we can fix it together.
      </p>
    </div>

    <form id="form" method="POST" action="/submit" novalidate>
      ${qScale("q1_overall_feeling", "1. How are you feeling about Reletix overall right now?", "Disengaged", "Energized", true)}
      ${qChoice("q2_skipped_frequency", "2. In the last month, how often have you skipped a Reletix call or gathering?", QUESTIONS.q2_skipped_frequency.options, "radio", true)}
      ${qChoice("q3_reasons", "3. What's the main reason you've been missing calls/gatherings?", QUESTIONS.q3_reasons.options, "checkbox", false, "Select all that apply")}
      ${qScale("q4_product_rating", "4. How would you rate Reletix AI as a product today?", "Not working for me", "Excellent", true)}
      ${qText("q5_one_thing_to_change", "5. What's the ONE thing about Reletix AI you'd change first?", true, "Be specific — one thing is enough", 4)}
      ${qScale("q6_vision_clarity", "6. How clear is the direction and vision of Reletix to you right now?", "Very unclear", "Crystal clear", true)}
      ${qChoice("q7_belief_in_direction", "7. Do you still believe in where Reletix is heading?", QUESTIONS.q7_belief_in_direction.options, "radio", true)}
      ${qScale("q8_morale", "8. How is your motivation and morale on the team lately?", "Very low", "Very high", true)}
      ${qText("q9_what_would_bring_back", "9. What would make you want to attend calls and gatherings again?", true, "What would actually change your mind?", 5)}
      ${qText("q10_holding_back", "10. Is there anything you've been holding back from saying?", false, "Safe, anonymous space. Tell us what we need to hear.", 6)}
      ${qText("q11_contact", "11. (Optional) If you'd like to talk 1:1, leave a way to reach you.", false, "Leaving this blank keeps you fully anonymous.", 1)}

      <button type="submit" class="submit" id="submitBtn">Submit anonymously</button>
      <div class="progress-saved" id="saved">Draft saved locally</div>
    </form>

    <p class="footer">Built for the ${team} team. Responses go straight to a private dashboard.</p>
  </div>

  <script>
    const form = document.getElementById('form');
    const KEY = 'reletix-survey-draft-v1';

    // Restore draft
    try {
      const draft = JSON.parse(localStorage.getItem(KEY) || '{}');
      for (const [name, val] of Object.entries(draft)) {
        const els = form.querySelectorAll('[name="' + name + '"]');
        if (!els.length) continue;
        if (els[0].type === 'radio' || els[0].type === 'checkbox') {
          const vals = Array.isArray(val) ? val : [val];
          els.forEach(el => { if (vals.includes(el.value)) el.checked = true; });
        } else {
          els[0].value = val;
        }
      }
    } catch (e) {}

    // Save draft on change
    const saved = document.getElementById('saved');
    let saveTimer;
    form.addEventListener('input', () => {
      const data = {};
      new FormData(form).forEach((v, k) => {
        if (data[k] !== undefined) {
          data[k] = [].concat(data[k], v);
        } else {
          data[k] = v;
        }
      });
      localStorage.setItem(KEY, JSON.stringify(data));
      saved.classList.add('show');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saved.classList.remove('show'), 1500);
    });

    // Clear draft on submit success
    form.addEventListener('submit', () => {
      localStorage.removeItem(KEY);
      document.getElementById('submitBtn').disabled = true;
      document.getElementById('submitBtn').textContent = 'Submitting…';
    });
  </script>
</body>
</html>`;
}

function qScale(name, title, leftLabel, rightLabel, required) {
  const opts = [1, 2, 3, 4, 5]
    .map(
      (n) => `
      <label>
        <input type="radio" name="${name}" value="${n}" ${required ? "required" : ""} />
        <span>${n}</span>
      </label>`
    )
    .join("");
  return `
    <div class="q">
      <label class="title">${title}${required ? '<span class="req">*</span>' : ""}</label>
      <div class="scale">
        ${opts}
        <div class="ends"><span>${leftLabel}</span><span>${rightLabel}</span></div>
      </div>
    </div>`;
}

function qChoice(name, title, options, type, required, help) {
  const opts = options
    .map(
      (o) => `
      <label>
        <input type="${type}" name="${name}" value="${escapeHtml(o)}" ${
        required && type === "radio" ? "required" : ""
      } />
        <span>${escapeHtml(o)}</span>
      </label>`
    )
    .join("");
  return `
    <div class="q">
      <label class="title">${title}${required ? '<span class="req">*</span>' : ""}</label>
      ${help ? `<div class="help">${help}</div>` : ""}
      <div class="choices">${opts}</div>
    </div>`;
}

function qText(name, title, required, placeholder, rows) {
  return `
    <div class="q">
      <label class="title" for="${name}">${title}${required ? '<span class="req">*</span>' : ""}</label>
      <textarea id="${name}" name="${name}" rows="${rows}" ${
    required ? "required" : ""
  } placeholder="${escapeHtml(placeholder || "")}"></textarea>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function thanksPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Thank you</title>
  <style>${baseCSS}
    .card { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center; }
    .check { font-size: 48px; margin-bottom: 16px; }
    h2 { margin: 0 0 12px; }
    p { color: var(--muted); margin: 8px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="check">✓</div>
      <h2>Thank you</h2>
      <p>Your response has been recorded — anonymously.</p>
      <p>We'll read every answer and share what we learn with the team.</p>
    </div>
  </div>
</body>
</html>`;
}

function adminPage(rows, stats, token) {
  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td>${r.id}</td>
        <td>${r.submitted_at}</td>
        <td>${r.q1_overall_feeling ?? ""}</td>
        <td>${escapeHtml(r.q2_skipped_frequency || "")}</td>
        <td>${escapeHtml(r.q3_reasons || "")}</td>
        <td>${r.q4_product_rating ?? ""}</td>
        <td>${escapeHtml(r.q5_one_thing_to_change || "")}</td>
        <td>${r.q6_vision_clarity ?? ""}</td>
        <td>${escapeHtml(r.q7_belief_in_direction || "")}</td>
        <td>${r.q8_morale ?? ""}</td>
        <td>${escapeHtml(r.q9_what_would_bring_back || "")}</td>
        <td>${escapeHtml(r.q10_holding_back || "")}</td>
        <td>${escapeHtml(r.q11_contact || "")}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Survey admin</title>
  <style>${baseCSS}
    .wrap { max-width: 1400px; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
    .stat .v { font-size: 28px; font-weight: 700; }
    .stat .l { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: 12px; overflow: hidden; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; max-width: 220px; word-wrap: break-word; }
    th { background: var(--panel-2); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .actions { margin-bottom: 16px; display: flex; gap: 12px; }
    .actions a { background: var(--accent); color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    @media (max-width: 800px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <div class="wrap">
    <header><h1>Survey responses</h1></header>
    <div class="stats">
      <div class="stat"><div class="v">${stats.total ?? 0}</div><div class="l">Responses</div></div>
      <div class="stat"><div class="v">${stats.avg_overall ?? "—"}</div><div class="l">Avg feeling</div></div>
      <div class="stat"><div class="v">${stats.avg_product ?? "—"}</div><div class="l">Avg product</div></div>
      <div class="stat"><div class="v">${stats.avg_vision ?? "—"}</div><div class="l">Avg vision</div></div>
      <div class="stat"><div class="v">${stats.avg_morale ?? "—"}</div><div class="l">Avg morale</div></div>
    </div>
    <div class="actions">
      <a href="/admin/export.csv?token=${encodeURIComponent(token)}">Export CSV</a>
    </div>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Submitted</th><th>Q1</th><th>Q2 Skipped</th><th>Q3 Reasons</th>
            <th>Q4 Product</th><th>Q5 Change</th><th>Q6 Vision</th><th>Q7 Belief</th>
            <th>Q8 Morale</th><th>Q9 Bring back</th><th>Q10 Holding back</th><th>Q11 Contact</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:40px;">No responses yet</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}
