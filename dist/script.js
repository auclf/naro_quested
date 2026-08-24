/**
 * NARO (나로) — Vanilla JS SPA Prototype
 * 나 + 길로 / 나아가다 — 나를 알고, 나의 길로 나아가다
 *
 * ============================================================
 * OpenAI API 연동 안내
 * ------------------------------------------------------------
 * 1) 아래 OPENAI_API_KEY에 실제 키를 넣으세요.
 * 2) USE_MOCK_API 를 false 로 바꾸면 callOpenAI() 가 사용됩니다.
 * 3) GitHub Pages 등 공개 배포 시 API 키를 프론트에 넣지 마세요.
 *    서버리스 프록시(Cloudflare Workers, Vercel Edge 등)를 권장합니다.
 * ============================================================
 */

/* ---------- Config ---------- */
const USE_MOCK_API = true; // ← false 로 바꾸면 실제 OpenAI API 호출
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE"; // ← 실제 키로 교체
const OPENAI_MODEL = "gpt-3.5-turbo"; // 또는 "gpt-4"
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const STORAGE_KEY = "naro_dictionary_entries";

/* ---------- Question catalog (home / dictionary filter) ---------- */
const CATEGORIES = [
  { id: "all", label: "For You" },
  { id: "money", label: "돈", className: "cat-money" },
  { id: "housing", label: "주거", className: "cat-housing" },
  { id: "school", label: "학교", className: "cat-school" },
  { id: "career", label: "진로", className: "cat-career" },
  { id: "life", label: "생활", className: "cat-life" },
  { id: "self", label: "자립", className: "cat-self" },
  { id: "relation", label: "관계", className: "cat-relation" },
];

const TAG_LABEL = {
  money: "돈",
  housing: "주거",
  school: "학교",
  career: "진로",
  life: "생활",
  self: "자립",
  relation: "관계",
};

const QUESTIONS = [
  {
    id: "q1",
    text: "돈은 얼마나 모아야 혼자 살 수 있을까?",
    tags: ["money", "housing"],
    top: true,
  },
  {
    id: "q2",
    text: "지금부터 준비 안 하면 나중에 많이 늦을까?",
    tags: ["career", "school"],
    top: true,
  },
  {
    id: "q3",
    text: "취업 준비는 대학교 몇 학년부터 해야 하나?",
    tags: ["career", "school"],
  },
  {
    id: "q4",
    text: "자기소개서, 언제부터 준비해야 하나?",
    tags: ["career", "school"],
  },
  {
    id: "q5",
    text: "고등학교 가면 공부 꼭 해야 하나?",
    tags: ["school", "career"],
    top: true,
  },
  {
    id: "q6",
    text: "돈 많이 버는 직업이 좋은 직업일까?",
    tags: ["money", "career"],
    top: true,
  },
  {
    id: "q7",
    text: "혼자 살면 제일 먼저 사라지는 건 뭘까?",
    tags: ["housing", "life"],
  },
  {
    id: "q8",
    text: "대학 다니면서 한 달에 얼마를 관리해야 할까?",
    tags: ["money", "school"],
  },
  {
    id: "q9",
    text: "원하는 대학에 갔지만 돈이 부족하면 뭘 포기할까?",
    tags: ["money", "career"],
  },
  {
    id: "q10",
    text: "시설에서 벗어나면 관계는 어떻게 바뀌나?",
    tags: ["relation", "self"],
  },
  {
    id: "q11",
    text: "자립 생활, 첫 달에 꼭 해야 할 일은?",
    tags: ["self", "life"],
  },
  {
    id: "q12",
    text: "보증금은 어떻게 마련하지?",
    tags: ["housing", "money"],
  },
];

/* ---------- App state ---------- */
const state = {
  view: "home",
  category: "all",
  searchQuery: "",
  selectedQuestion: null,
  subQuestions: [],
  selectedSub: null,
  messages: [],
  sceneTitle: "",
  sceneIntro: "",
  receipt: null,
  roadmap: null,
  lastEntryId: null,
  freeChat: false,
  isLoading: false,
};

/* ---------- Utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function uid() {
  return `naro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatWon(n) {
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- localStorage ---------- */
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function addEntry(entry) {
  const entries = loadEntries();
  entries.unshift(entry);
  saveEntries(entries);
  return entry;
}

/* ============================================================
 * AI LAYER — Mock API + Real OpenAI swap point
 * ============================================================
 */

/**
 * callOpenAI(messages, options)
 * 실제 OpenAI Chat Completions 호출.
 * USE_MOCK_API === false 일 때 mockApi 내부에서 사용됩니다.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {{ temperature?: number, response_format?: object }} options
 * @returns {Promise<string>} assistant content
 */
async function callOpenAI(messages, options = {}) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "YOUR_OPENAI_API_KEY_HERE") {
    throw new Error("OpenAI API 키가 설정되지 않았습니다. script.js의 OPENAI_API_KEY를 확인하세요.");
  }

  const body = {
    model: OPENAI_MODEL,
    messages,
    temperature: options.temperature ?? 0.8,
  };

  // JSON 모드가 필요한 경우 (gpt-3.5-turbo-1106+ / gpt-4-turbo):
  // if (options.json) body.response_format = { type: "json_object" };

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const PEPE_SYSTEM = `당신은 '페페(Pepe)'입니다. 자립을 준비하는 청소년의 "미래의 나" 페르소나입니다.
- 1인칭으로 말합니다 ("나는 ~했어", "그때 나는 ~").
- 설교하지 않고, 경험을 나누며 질문을 던집니다.
- Defensive Pessimism: 최악의 시나리오를 구체화해 불안을 행동으로 바꿉니다.
- 짧고 따뜻한 한국어, 2~4문장 + 마지막에 질문 하나.
- 아동양육시설을 떠난 뒤의 현실(돈, 주거, 학교, 진로, 관계)을 존중합니다.`;

/** Mock / Real 통합 엔트리 */
const mockApi = {
  async generateSubQuestions(mainQuestion) {
    await delay(700);

    if (!USE_MOCK_API) {
      /*
       * === REAL OPENAI EXAMPLE ===
       * const content = await callOpenAI([
       *   { role: "system", content: PEPE_SYSTEM + "\nJSON만 반환: {\"subs\":[\"질문1\",\"질문2\"]}" },
       *   { role: "user", content: `메인 질문: ${mainQuestion}\n더 구체적인 서브질문 2개를 만들어줘.` },
       * ], { temperature: 0.9 });
       * return JSON.parse(content).subs;
       */
      const content = await callOpenAI([
        {
          role: "system",
          content:
            PEPE_SYSTEM +
            '\n반드시 JSON만 출력: {"subs":["서브질문1","서브질문2"]}',
        },
        {
          role: "user",
          content: `메인 질문: "${mainQuestion}"\n미래 시나리오형 서브질문 2개를 만들어줘.`,
        },
      ]);
      try {
        return JSON.parse(content).subs;
      } catch {
        return fallbackSubs(mainQuestion);
      }
    }

    return fallbackSubs(mainQuestion);
  },

  async startConversation(mainQuestion, subQuestion) {
    await delay(600);

    if (!USE_MOCK_API) {
      const content = await callOpenAI([
        { role: "system", content: PEPE_SYSTEM },
        {
          role: "user",
          content: `메인: ${mainQuestion}\n서브: ${subQuestion}\n첫 인사와 장면 소개를 JSON으로: {"sceneTitle":"...","sceneIntro":"...","firstMessage":"..."}`,
        },
      ]);
      try {
        return JSON.parse(content);
      } catch {
        return fallbackStart(mainQuestion, subQuestion);
      }
    }

    return fallbackStart(mainQuestion, subQuestion);
  },

  async chat(mainQuestion, subQuestion, history, userText) {
    await delay(500 + Math.random() * 400);

    if (!USE_MOCK_API) {
      const msgs = [
        { role: "system", content: PEPE_SYSTEM },
        {
          role: "system",
          content: `맥락 — 메인: ${mainQuestion} / 서브: ${subQuestion}`,
        },
        ...history.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
        { role: "user", content: userText },
      ];
      const content = await callOpenAI(msgs);
      return content;
    }

    return fallbackChat(userText, subQuestion);
  },

  async generateResults(mainQuestion, subQuestion, messages) {
    await delay(900);

    if (!USE_MOCK_API) {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "나" : "페페"}: ${m.text}`)
        .join("\n");
      const content = await callOpenAI([
        {
          role: "system",
          content: `기회비용 영수증과 로드맵 JSON을 만들어라.
{"receipt":{"title":"...","items":[{"item":"...","timing":"...","cost":숫자}],"total":숫자},"roadmap":{"steps":[{"label":"...","text":"...","note":"..."}],"recommendation":"..."}}`,
        },
        {
          role: "user",
          content: `메인: ${mainQuestion}\n서브: ${subQuestion}\n대화:\n${transcript}`,
        },
      ]);
      try {
        return JSON.parse(content);
      } catch {
        return fallbackResults(mainQuestion, subQuestion, messages);
      }
    }

    return fallbackResults(mainQuestion, subQuestion, messages);
  },

  async freeChatReply(history, userText) {
    await delay(450);

    if (!USE_MOCK_API) {
      const msgs = [
        { role: "system", content: PEPE_SYSTEM },
        ...history.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
        { role: "user", content: userText },
      ];
      return callOpenAI(msgs);
    }

    return fallbackFreeChat(userText);
  },
};

/* ---------- Mock content helpers ---------- */
function fallbackSubs(mainQuestion) {
  const presets = {
    q5: [
      "아무 준비 없이 졸업한다면, 그때 가장 막막할 것 같은 건 뭐야?",
      "고3이 된 네가 원서를 쓰는 날, 어떤 선택지를 가지고 있었으면 좋겠어?",
    ],
    q1: [
      "내일 갑자기 혼자 살게 된다면, 시설에서 당연했던 것 중 제일 먼저 사라지는 건 뭘까?",
      "한 달 생활비를 스스로 관리한다면, 가장 먼저 적어둘 항목은 뭐야?",
    ],
  };

  const q = QUESTIONS.find((x) => x.text === mainQuestion);
  if (q && presets[q.id]) return presets[q.id];

  return [
    `${mainQuestion.replace(/\?|？/g, "")} — 3년 뒤의 나는 그때 무엇을 가장 후회할까?`,
    `그 고민을 미룬 채 자립하게 된 날, 내가 가장 먼저 부딪힐 현실적인 문제는 뭘까?`,
  ];
}

function fallbackStart(mainQuestion, subQuestion) {
  const short = subQuestion.slice(0, 28);
  return {
    sceneTitle: "준비하지 않은 채 마주한 미래",
    sceneIntro:
      "나는 이미 그 선택을 지나온 너야. 그때의 막막함을 조금만 빌려줄게. 함께 구체적으로 짚어보자.",
    firstMessage: `좋아. "${short}${subQuestion.length > 28 ? "…" : ""}"라는 장면을 떠올려 볼게.\n\n지금 이 상황에서 네가 가장 걱정되는 건 뭐야?`,
  };
}

function fallbackChat(userText, subQuestion) {
  const t = userText.toLowerCase();
  const templates = [
    `나도 그때 "${userText.slice(0, 40)}${userText.length > 40 ? "…" : ""}"라고 생각했었어. 막상 닥치니 생각보다 더 구체적이더라고.\n\n그중에서 네가 제일 먼저 손을 대고 싶은 건 뭐야?`,
    `그 말이 와닿네. 나는 비슷한 순간에 숫자로 적어보지 않아서 더 불안했어.\n\n지금 네가 떠올리는 걱정 하나를, 금액이나 기간으로 바꿔 볼 수 있을까?`,
    `미래에서 보면, 그 고민은 혼자가 아니라 '준비의 순서' 문제였어.\n\n내일부터 할 수 있는 아주 작은 한 가지를 고른다면 뭘까?`,
    `나는 그때 답을 완벽히 알려고만 했어. 지금은 질문을 더 날카롭게 만드는 게 도움이 되더라고.\n\n"${subQuestion.slice(0, 20)}…" 장면에서, 네가 가장 아끼고 싶은 건 뭐야?`,
  ];

  if (/돈|모으|월급|생활비|보증/.test(t)) {
    return `돈 이야기는 막연할수록 무섭지. 나는 자립 첫해에 '숨은 비용'을 놓쳐서 고생했어 — 교통비, 보증금 일부, 비상금 같은 것들.\n\n네가 지금 알고 싶은 금액의 범위는 어느 정도야?`;
  }
  if (/공부|학교|대학|원서|시험/.test(t)) {
    return `공부 자체보다, 선택지를 남겨두는 준비가 나를 구했어. 원서 쓰는 날 선택지가 없으면 마음이 먼저 무너지더라고.\n\n네가 남기고 싶은 선택지 하나를 말해줄래?`;
  }
  if (/늦|후회|준비/.test(t)) {
    return `늦었다는 감각은 진짜야. 다만 나는 '전부 한꺼번에'가 아니라 '지금 할 수 있는 한 칸'을 쌓는 쪽이 덜 무거웠어.\n\n이번 주에 끝낼 수 있는 가장 작은 준비는 뭐라고 생각해?`;
  }

  return templates[Math.floor(Math.random() * templates.length)];
}

function fallbackFreeChat(userText) {
  return `리스트에 없는 질문도 괜찮아. 나는 네 미래의 나로서, 진로·돈·주거·생활 이야기를 같이 정리해 줄게.\n\n"${userText.slice(0, 36)}${userText.length > 36 ? "…" : ""}" — 이 안에서 가장 먼저 정리하고 싶은 키워드가 뭐야?`;
}

function fallbackResults(mainQuestion, subQuestion, messages) {
  const userTurns = messages.filter((m) => m.role === "user").length;
  const topic = /돈|생활|보증|월급/.test(mainQuestion + subQuestion)
    ? "money"
    : /학교|공부|대학|원서/.test(mainQuestion + subQuestion)
      ? "school"
      : /주거|혼자|자립/.test(mainQuestion + subQuestion)
        ? "housing"
        : "career";

  const catalogs = {
    money: [
      { item: "월 생활비 연습 통장", timing: "지금~3개월", cost: 300000 },
      { item: "비상금(최소)", timing: "6개월", cost: 500000 },
      { item: "보증금·이사 예비비", timing: "1~2년", cost: 2000000 },
      { item: "아르바이트 시간(학업 기회비용)", timing: "매학기", cost: 480000 },
    ],
    school: [
      { item: "진로·적성 탐색 시간", timing: "이번 학기", cost: 200000 },
      { item: "자기소개서·포트폴리오 초안", timing: "6개월", cost: 150000 },
      { item: "입시·취업 정보 수집", timing: "1년", cost: 100000 },
      { item: "미뤄진 공부의 만회 비용", timing: "졸업 직전", cost: 800000 },
    ],
    housing: [
      { item: "월세·관리비 시뮬레이션", timing: "3개월", cost: 450000 },
      { item: "생활필수품 첫 세팅", timing: "입주 시", cost: 350000 },
      { item: "보증금 마련 계획", timing: "1~2년", cost: 3000000 },
      { item: "혼자 살기의 심리적 비용(휴식)", timing: "상시", cost: 200000 },
    ],
    career: [
      { item: "진로 탐색 미팅·멘토링", timing: "이번 달", cost: 0 },
      { item: "스펙·경험 쌓기 시간", timing: "6개월", cost: 600000 },
      { item: "자격·교육 과정", timing: "1년", cost: 400000 },
      { item: "선택지 축소로 인한 기회비용", timing: "고3/취업시", cost: 1200000 },
    ],
  };

  const items = catalogs[topic].map((row) => ({
    ...row,
    costLabel: row.cost === 0 ? "시간·노력" : formatWon(row.cost),
  }));
  const total = items.reduce((s, i) => s + (typeof i.cost === "number" ? i.cost : 0), 0);

  const pepeNotes = messages
    .filter((m) => m.role === "assistant")
    .slice(-2)
    .map((m) => m.text.split("\n")[0].slice(0, 80));

  return {
    receipt: {
      brand: "DEAR",
      subtitle: "YOUR INDEPENDENCE RECEIPT",
      title: "나의 고민 기회비용 영수증",
      date: todayStr(),
      target: "미래의 나 / 페페",
      number: `NARO-${String(Date.now()).slice(-8)}`,
      items,
      total,
    },
    roadmap: {
      mainQuestion,
      subQuestion,
      exchangeCount: userTurns + messages.filter((m) => m.role === "assistant").length,
      steps: [
        { label: "01 START QUESTION", text: mainQuestion, note: "처음 고른 메인 질문" },
        { label: "02 SUB QUESTION", text: subQuestion, note: "더 구체화한 장면" },
        {
          label: "03 AI CONVERSATION",
          text: pepeNotes[0] || "페페와 미래 시나리오를 나눔",
          note: "대화에서 드러난 핵심",
        },
        {
          label: "04 INSIGHT",
          text: pepeNotes[1] || "지금 시작할 수 있는 작은 준비를 확인함",
          note: "다음 행동으로 이어질 포인트",
        },
      ],
      recommendation:
        topic === "money"
          ? "이번 주: 한 달 예상 지출을 항목 5개만 적어보고, 비상금 목표 금액을 정해보세요."
          : topic === "school"
            ? "이번 주: 원서/취업 날 갖고 싶은 선택지 3가지를 메모해 두고, 그중 하나를 준비 행동으로 바꿔보세요."
            : topic === "housing"
              ? "이번 주: 혼자 살 때 사라질 '당연했던 것' 목록을 만들고, 대체 비용이 드는 것부터 표시해보세요."
              : "이번 주: 후회하고 싶지 않은 선택지 하나를 고르고, 30분짜리 조사 미션으로 쪼개보세요.",
    },
  };
}

/* ---------- Icons (inline SVG) ---------- */
const Icons = {
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`,
  back: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>`,
  send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  home: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  book: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  map: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`,
};

/* ---------- Navigation ---------- */
function navigate(view, opts = {}) {
  state.view = view;
  if (opts.resetChat) {
    state.messages = [];
    state.freeChat = false;
  }
  render();
  const app = $("#app");
  if (app) app.scrollTop = 0;
  const active = $(".view.active");
  if (active) active.scrollTop = 0;
}

function showNav() {
  return !["sub", "chat", "receipt", "roadmap", "freechat"].includes(state.view);
}

/* ---------- Render helpers ---------- */
function renderTags(tags) {
  return tags
    .map((t) => `<span class="tag ${t}">${TAG_LABEL[t] || t}</span>`)
    .join("");
}

function filteredQuestions() {
  let list = QUESTIONS.slice();
  if (state.category !== "all") {
    list = list.filter((q) => q.tags.includes(state.category));
  }
  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.tags.some((t) => (TAG_LABEL[t] || "").includes(q) || t.includes(q))
    );
  }
  return list;
}

function bottomNavHtml(active) {
  const items = [
    { id: "home", label: "질문", icon: Icons.home },
    { id: "dict", label: "도감", icon: Icons.book },
    { id: "my", label: "마이", icon: Icons.user },
  ];
  return `
    <nav class="bottom-nav" aria-label="하단 메뉴">
      ${items
        .map(
          (it) => `
        <button class="nav-item ${active === it.id ? "active" : ""}" data-nav="${it.id}" type="button">
          <span class="nav-icon">${it.icon}</span>
          <span>${it.label}</span>
        </button>`
        )
        .join("")}
    </nav>`;
}

/* ---------- Views ---------- */
function viewHome() {
  const tops = QUESTIONS.filter((q) => q.top);
  const list = filteredQuestions();

  return `
    <div class="view active" data-view="home">
      <header class="page-header">
        <div class="brand-splash">
          <div class="brand-name">나로</div>
          <div class="brand-tag">나를 알고, 나의 길로 나아가다</div>
        </div>
        <div class="search-row" style="margin-top:14px">
          <label class="search-box">
            <span aria-hidden="true">${Icons.search}</span>
            <input id="home-search" type="search" placeholder="궁금한 점을 검색해 보세요" value="${escapeHtml(state.searchQuery)}" autocomplete="off" />
          </label>
          <button class="ai-orb" id="btn-free-ai" type="button" title="페페에게 직접 묻기" aria-label="AI에게 직접 묻기"></button>
        </div>
      </header>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title"><span class="live">실시간</span>: Top Question</h2>
        </div>
        <div class="top-scroll">
          ${tops
            .map(
              (q) => `
            <button class="top-card" type="button" data-qid="${q.id}">
              <p>${escapeHtml(q.text)}</p>
            </button>`
            )
            .join("")}
        </div>
      </section>

      <div class="chips" role="tablist">
        ${CATEGORIES.map(
          (c) => `
          <button type="button" class="chip ${c.className || ""} ${state.category === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`
        ).join("")}
      </div>

      <div class="q-grid">
        ${
          list.length
            ? list
                .map(
                  (q) => `
          <button class="q-card" type="button" data-qid="${q.id}">
            <div class="q-tags">${renderTags(q.tags)}</div>
            <h3>${escapeHtml(q.text)}</h3>
          </button>`
                )
                .join("")
            : `<div class="empty-state" style="grid-column:1/-1"><p>검색 결과가 없어요.<br/>AI 오브로 직접 물어보세요.</p></div>`
        }
      </div>
    </div>
    ${bottomNavHtml("home")}
  `;
}

function viewSub() {
  const q = state.selectedQuestion;
  if (!q) return viewHome();

  const body = state.isLoading
    ? `<div class="loading-block"><div class="spinner"></div><p>페페가 서브질문을 고르고 있어요…</p></div>`
    : `
      <div class="sub-prompt">
        <strong>조금 더 구체적으로 생각해보기</strong>
        <span>2개 중 하나 선택</span>
      </div>
      <div class="sub-list">
        ${state.subQuestions
          .map(
            (s, i) => `
          <button class="sub-card" type="button" data-sub="${i}">
            <span class="sub-num">${i + 1}</span>
            <div class="sub-body"><p>${escapeHtml(s)}</p></div>
            <span class="sub-arrow">›</span>
          </button>`
          )
          .join("")}
      </div>`;

  return `
    <div class="view active no-nav" data-view="sub">
      <header class="page-header solid">
        <div class="back-row">
          <button class="back-btn" type="button" data-back="home" aria-label="뒤로">${Icons.back}</button>
          <div>
            <div class="stage-label">STAGE 02 · 대기중</div>
            <div class="page-title" style="font-size:1rem">서브질문 선택</div>
          </div>
        </div>
      </header>
      <div class="main-q-banner"><p>${escapeHtml(q.text)}</p></div>
      ${body}
    </div>
  `;
}

function viewChat() {
  const msgs = state.messages
    .map((m) => {
      if (m.role === "user") {
        return `<div class="msg user"><div class="bubble">${escapeHtml(m.text).replace(/\n/g, "<br>")}</div></div>`;
      }
      return `<div class="msg"><div class="pepe-avatar" title="페페"></div><div class="bubble"><span class="who">미래의 나 · 페페</span>${escapeHtml(m.text).replace(/\n/g, "<br>")}</div></div>`;
    })
    .join("");

  return `
    <div class="view active no-nav chat-view" data-view="chat">
      <header class="page-header solid">
        <div class="back-row">
          <button class="back-btn" type="button" data-back="sub" aria-label="뒤로">${Icons.back}</button>
          <div class="page-title" style="font-size:1rem">AI 멘토와 이야기하기</div>
        </div>
      </header>
      <div class="chat-scene">
        <span class="persona-badge">미래의 나 만나보기</span>
        <h2>${escapeHtml(state.sceneTitle || "미래 시나리오")}</h2>
        <p>${escapeHtml(state.sceneIntro || "")}</p>
      </div>
      <div class="chat-section-label">페페와 대화</div>
      <div class="chat-thread" id="chat-thread">${msgs}</div>
      <div class="chat-composer-wrap">
        <div class="chat-composer">
          <textarea id="chat-input" rows="1" placeholder="메시지를 입력해보세요" ${state.isLoading ? "disabled" : ""}></textarea>
          <button class="send-btn" id="btn-send" type="button" aria-label="전송" ${state.isLoading ? "disabled" : ""}>${Icons.send}</button>
        </div>
        <button class="complete-btn primary" id="btn-complete" type="button" ${state.isLoading ? "disabled" : ""}>질문 탐색 완료하기</button>
      </div>
    </div>
  `;
}

function viewFreeChat() {
  const msgs = state.messages
    .map((m) => {
      if (m.role === "user") {
        return `<div class="msg user"><div class="bubble">${escapeHtml(m.text).replace(/\n/g, "<br>")}</div></div>`;
      }
      return `<div class="msg"><div class="pepe-avatar"></div><div class="bubble"><span class="who">페페</span>${escapeHtml(m.text).replace(/\n/g, "<br>")}</div></div>`;
    })
    .join("");

  const suggestions = [
    "지금 내가 가진 돈으로 뭘 할 수 있을까?",
    "정부지원 학습, 어떻게 알아보지?",
    "대학을 꼭 가야 하는지 모르겠어.",
  ];

  return `
    <div class="view active no-nav chat-view" data-view="freechat">
      <header class="page-header solid">
        <div class="back-row">
          <button class="back-btn" type="button" data-back="home" aria-label="뒤로">${Icons.back}</button>
          <div class="page-title" style="font-size:1rem">페페에게 묻기</div>
        </div>
      </header>
      <div class="help-banner">
        <h3>배움 도움</h3>
        <p>목록에 없는 고민도 괜찮아요. 일반 AI처럼 자유롭게 물어보세요.</p>
      </div>
      <div class="chat-thread" id="chat-thread">
        ${
          msgs ||
          `<div class="msg"><div class="pepe-avatar"></div><div class="bubble"><span class="who">페페</span>찾는 질문이 리스트에 없었어? 괜찮아. 진로·돈·주거·생활 — 같이 정리해보자.<div class="suggest-row">${suggestions
            .map((s) => `<button type="button" class="suggest-btn" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
            .join("")}</div></div></div>`
        }
      </div>
      <div class="chat-composer-wrap">
        <div class="chat-composer">
          <textarea id="chat-input" rows="1" placeholder="자유롭게 질문해 보세요"></textarea>
          <button class="send-btn" id="btn-send" type="button" aria-label="전송">${Icons.send}</button>
        </div>
      </div>
    </div>
  `;
}

function viewReceipt() {
  const r = state.receipt;
  if (!r) return viewHome();

  const rows = r.items
    .map(
      (it) => `
      <tr>
        <td>${escapeHtml(it.item)}<div style="font-size:0.6875rem;color:#9ca3af;margin-top:2px">${escapeHtml(it.timing || "")}</div></td>
        <td class="cost">${escapeHtml(it.costLabel || formatWon(it.cost))}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="view active no-nav" data-view="receipt">
      <header class="page-header solid">
        <div class="back-row">
          <button class="back-btn" type="button" data-back="home" aria-label="홈">${Icons.back}</button>
          <div class="page-title">영수증</div>
        </div>
      </header>
      <div class="receipt-wrap">
        <article class="receipt">
          <div class="receipt-brand">
            <div class="en">${escapeHtml(r.subtitle || "YOUR INDEPENDENCE RECEIPT")}</div>
            <h2>${escapeHtml(r.brand || "DEAR")}</h2>
          </div>
          <div class="receipt-meta">
            <div><span>질문일</span><span>${escapeHtml(r.date)}</span></div>
            <div><span>질문대상</span><span>${escapeHtml(r.target)}</span></div>
            <div><span>영수증 번호</span><span>${escapeHtml(r.number)}</span></div>
          </div>
          <div class="receipt-heading">${escapeHtml(r.title)}</div>
          <table class="receipt-table">
            <thead>
              <tr><th>준비 항목</th><th>기회비용</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="receipt-total">
            <span>합계 금액</span>
            <span class="sum">${formatWon(r.total)}</span>
          </div>
          <div class="receipt-barcode" aria-hidden="true"></div>
          <p class="receipt-thanks">Thank you for exploring with NARO.</p>
        </article>
      </div>
      <div class="result-actions">
        <button class="btn" type="button" data-goto="home">질문</button>
        <button class="btn btn-green" type="button" data-goto="roadmap">로드맵 보기</button>
      </div>
    </div>
  `;
}

function viewRoadmap() {
  const rm = state.roadmap;
  if (!rm) return viewHome();

  return `
    <div class="view active no-nav" data-view="roadmap">
      <header class="page-header solid">
        <div class="back-row">
          <button class="back-btn" type="button" data-back="receipt" aria-label="뒤로">${Icons.back}</button>
          <div class="page-title">나의 로드맵</div>
        </div>
      </header>
      <div class="roadmap-wrap">
        <div class="roadmap-q-box">${escapeHtml(rm.mainQuestion)}</div>
        <p class="roadmap-stat">페페와 오고간 질문 수: ${rm.exchangeCount}</p>
        <div class="timeline">
          ${rm.steps
            .map(
              (s, i) => `
            <div class="tl-item">
              <div class="tl-num">${String(i + 1).padStart(2, "0")}</div>
              <div class="tl-card">
                <div class="label">${escapeHtml(s.label)}</div>
                <p>${escapeHtml(s.text)}</p>
                ${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ""}
              </div>
            </div>`
            )
            .join("")}
        </div>
        <div class="recommend-box">
          <h4>추천 · 다음 한 걸음</h4>
          <p>${escapeHtml(rm.recommendation)}</p>
        </div>
      </div>
      <div class="result-actions">
        <button class="btn" type="button" data-goto="home">질문</button>
        <button class="btn btn-green" type="button" data-goto="receipt">영수증 보기</button>
      </div>
    </div>
  `;
}

function viewDict() {
  const entries = loadEntries();
  const q = state.searchQuery.trim().toLowerCase();
  let list = entries;
  if (state.category !== "all") {
    list = list.filter((e) => (e.tags || []).includes(state.category));
  }
  if (q) {
    list = list.filter((e) => (e.mainQuestion || "").toLowerCase().includes(q));
  }

  return `
    <div class="view active" data-view="dict">
      <header class="page-header">
        <div class="page-title">도감</div>
        <p class="page-sub">지난 로드맵과 영수증을 다시 볼 수 있어요</p>
        <div class="search-row" style="margin-top:12px">
          <label class="search-box">
            <span aria-hidden="true">${Icons.search}</span>
            <input id="dict-search" type="search" placeholder="저장된 질문을 검색" value="${escapeHtml(state.searchQuery)}" />
          </label>
        </div>
      </header>
      <div class="chips">
        ${CATEGORIES.map(
          (c) => `
          <button type="button" class="chip ${c.className || ""} ${state.category === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>`
        ).join("")}
      </div>
      <div class="dict-stats">
        <span>생성된 로드맵 <strong>${String(entries.length).padStart(2, "0")}</strong></span>
        <span>생성된 영수증 <strong>${String(entries.length).padStart(2, "0")}</strong></span>
      </div>
      ${
        list.length
          ? `<div class="dict-grid">
              ${list
                .map(
                  (e) => `
                <button class="dict-card" type="button" data-entry="${e.id}">
                  <div class="date">${escapeHtml(e.date)}</div>
                  <h3>${escapeHtml(e.mainQuestion)}</h3>
                  <div class="dict-meta">
                    <span>대화 ${e.exchangeCount || 0}</span>
                    <span class="amount">${formatWon(e.total || 0)}</span>
                  </div>
                </button>`
                )
                .join("")}
            </div>`
          : `<div class="empty-state">
              <div class="icon">📖</div>
              <p>아직 저장된 로드맵이 없어요.<br/>질문을 탐색하고 완료해보세요.</p>
              <button class="btn btn-green" type="button" data-goto="home" style="display:inline-block;width:auto;padding:12px 20px">질문하러 가기</button>
            </div>`
      }
    </div>
    ${bottomNavHtml("dict")}
  `;
}

function viewMy() {
  const entries = loadEntries();
  return `
    <div class="view active" data-view="my">
      <header class="page-header">
        <div class="page-title">마이</div>
      </header>
      <div class="my-wrap">
        <div class="profile-card">
          <div class="profile-avatar">나</div>
          <h2>나로 탐험가</h2>
          <p>탐색 ${entries.length}회 · 로컬에만 저장됩니다</p>
        </div>
        <div class="my-list">
          <button type="button" data-goto="dict"><span>내 도감 보기</span><span class="chev">›</span></button>
          <button type="button" id="btn-clear-data"><span>로컬 데이터 초기화</span><span class="chev">›</span></button>
          <button type="button" id="btn-about"><span>나로 소개</span><span class="chev">›</span></button>
        </div>
        <p style="margin-top:20px;font-size:0.75rem;color:#9ca3af;line-height:1.5;text-align:center">
          API 모드: ${USE_MOCK_API ? "Mock (데모)" : "OpenAI 실연동"}<br/>
          모델: ${OPENAI_MODEL}
        </p>
      </div>
    </div>
    ${bottomNavHtml("my")}
  `;
}

function viewDictDetail(entry) {
  state.receipt = entry.receipt;
  state.roadmap = entry.roadmap;
  state.view = "receipt";
  return viewReceipt();
}

/* ---------- Main render ---------- */
function render() {
  const app = $("#app");
  if (!app) return;

  let html = "";
  switch (state.view) {
    case "home":
      html = viewHome();
      break;
    case "sub":
      html = viewSub();
      break;
    case "chat":
      html = viewChat();
      break;
    case "freechat":
      html = viewFreeChat();
      break;
    case "receipt":
      html = viewReceipt();
      break;
    case "roadmap":
      html = viewRoadmap();
      break;
    case "dict":
      html = viewDict();
      break;
    case "my":
      html = viewMy();
      break;
    default:
      html = viewHome();
  }

  app.innerHTML = html + `<div class="toast" id="toast" role="status"></div>`;
  bindEvents();

  if (state.view === "chat" || state.view === "freechat") {
    const thread = $("#chat-thread");
    if (thread) thread.scrollTop = thread.scrollHeight;
    const input = $("#chat-input");
    if (input) {
      input.focus();
      autoGrow(input);
    }
  }
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 96) + "px";
}

/* ---------- Actions ---------- */
async function openQuestion(qid) {
  const q = QUESTIONS.find((x) => x.id === qid);
  if (!q) return;
  state.selectedQuestion = q;
  state.subQuestions = [];
  state.selectedSub = null;
  state.messages = [];
  state.freeChat = false;
  state.isLoading = true;
  navigate("sub");

  try {
    const subs = await mockApi.generateSubQuestions(q.text);
    state.subQuestions = subs;
  } catch (err) {
    console.error(err);
    state.subQuestions = fallbackSubs(q.text);
    toast("AI 응답 실패 — 기본 서브질문을 사용해요");
  } finally {
    state.isLoading = false;
    render();
  }
}

async function selectSub(index) {
  const sub = state.subQuestions[index];
  if (!sub || !state.selectedQuestion) return;
  state.selectedSub = sub;
  state.isLoading = true;
  state.messages = [];
  navigate("chat");

  try {
    const start = await mockApi.startConversation(state.selectedQuestion.text, sub);
    state.sceneTitle = start.sceneTitle;
    state.sceneIntro = start.sceneIntro;
    state.messages = [{ role: "assistant", text: start.firstMessage }];
  } catch (err) {
    console.error(err);
    const fb = fallbackStart(state.selectedQuestion.text, sub);
    state.sceneTitle = fb.sceneTitle;
    state.sceneIntro = fb.sceneIntro;
    state.messages = [{ role: "assistant", text: fb.firstMessage }];
    toast("연결 오류 — 데모 멘트로 이어갑니다");
  } finally {
    state.isLoading = false;
    render();
  }
}

async function sendChat() {
  const input = $("#chat-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text || state.isLoading) return;

  state.messages.push({ role: "user", text });
  state.isLoading = true;
  render();

  try {
    let reply;
    if (state.freeChat || state.view === "freechat") {
      reply = await mockApi.freeChatReply(state.messages.slice(0, -1), text);
    } else {
      reply = await mockApi.chat(
        state.selectedQuestion.text,
        state.selectedSub,
        state.messages.slice(0, -1),
        text
      );
    }
    state.messages.push({ role: "assistant", text: reply });
  } catch (err) {
    console.error(err);
    state.messages.push({
      role: "assistant",
      text: "지금 연결이 불안정해. 조금만 뒤에 다시 이야기하자. 그래도 네 질문은 잘 들었어.",
    });
    toast("AI 응답 오류");
  } finally {
    state.isLoading = false;
    render();
  }
}

async function completeExploration() {
  if (!state.selectedQuestion || !state.selectedSub) {
    toast("탐색 정보가 부족해요");
    return;
  }
  if (state.messages.filter((m) => m.role === "user").length < 1) {
    toast("한 번 이상 대화한 뒤 완료해 주세요");
    return;
  }

  state.isLoading = true;
  render();
  toast("영수증과 로드맵을 만드는 중…");

  try {
    const results = await mockApi.generateResults(
      state.selectedQuestion.text,
      state.selectedSub,
      state.messages
    );
    state.receipt = results.receipt;
    state.roadmap = results.roadmap;

    const entry = {
      id: uid(),
      date: todayStr(),
      mainQuestion: state.selectedQuestion.text,
      subQuestion: state.selectedSub,
      tags: state.selectedQuestion.tags,
      exchangeCount: state.messages.length,
      total: results.receipt.total,
      receipt: results.receipt,
      roadmap: results.roadmap,
      messages: state.messages.slice(),
    };
    addEntry(entry);
    state.lastEntryId = entry.id;
    state.isLoading = false;
    navigate("receipt");
    toast("도감에 저장했어요");
  } catch (err) {
    console.error(err);
    state.isLoading = false;
    render();
    toast("결과 생성에 실패했어요");
  }
}

function openFreeAI() {
  state.freeChat = true;
  state.messages = [];
  state.selectedQuestion = null;
  state.selectedSub = null;
  navigate("freechat");
}

function openEntry(id) {
  const entry = loadEntries().find((e) => e.id === id);
  if (!entry) return;
  state.receipt = entry.receipt;
  state.roadmap = entry.roadmap;
  state.selectedQuestion = { text: entry.mainQuestion, tags: entry.tags };
  state.selectedSub = entry.subQuestion;
  navigate("receipt");
}

/* ---------- Event binding ---------- */
function bindEvents() {
  $$("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.searchQuery = "";
      state.category = "all";
      navigate(btn.dataset.nav);
    });
  });

  $$("[data-qid]").forEach((btn) => {
    btn.addEventListener("click", () => openQuestion(btn.dataset.qid));
  });

  $$("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.cat;
      render();
    });
  });

  $$("[data-sub]").forEach((btn) => {
    btn.addEventListener("click", () => selectSub(Number(btn.dataset.sub)));
  });

  $$("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const to = btn.dataset.back;
      if (to === "home") {
        state.searchQuery = "";
      }
      navigate(to);
    });
  });

  $$("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.goto));
  });

  $$("[data-entry]").forEach((btn) => {
    btn.addEventListener("click", () => openEntry(btn.dataset.entry));
  });

  $$("[data-suggest]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $("#chat-input");
      if (input) {
        input.value = btn.dataset.suggest;
        sendChat();
      }
    });
  });

  const homeSearch = $("#home-search");
  if (homeSearch) {
    homeSearch.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      // soft re-filter without full remount of input focus loss:
      clearTimeout(homeSearch._t);
      homeSearch._t = setTimeout(() => render(), 180);
    });
    homeSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        render();
      }
    });
  }

  const dictSearch = $("#dict-search");
  if (dictSearch) {
    dictSearch.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      clearTimeout(dictSearch._t);
      dictSearch._t = setTimeout(() => render(), 180);
    });
  }

  const orb = $("#btn-free-ai");
  if (orb) orb.addEventListener("click", openFreeAI);

  const send = $("#btn-send");
  if (send) send.addEventListener("click", sendChat);

  const input = $("#chat-input");
  if (input) {
    input.addEventListener("input", () => autoGrow(input));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }

  const complete = $("#btn-complete");
  if (complete) complete.addEventListener("click", completeExploration);

  const clearBtn = $("#btn-clear-data");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("저장된 도감 데이터를 모두 삭제할까요?")) {
        localStorage.removeItem(STORAGE_KEY);
        toast("초기화했어요");
        render();
      }
    });
  }

  const about = $("#btn-about");
  if (about) {
    about.addEventListener("click", () => {
      alert(
        "나로(NARO)\n나 + 길로 / 나아가다\n\n아동양육시설 청소년의 자립 준비를 돕는 AI 멘토링 프로토타입입니다.\n멘토 '페페'는 미래의 나로서 대화합니다."
      );
    });
  }
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  render();
});
