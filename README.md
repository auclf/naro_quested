# 나로 (NARO) — Web Prototype

아동양육시설 청소년의 자립 준비를 돕는 AI 멘토링 앱 **나로**의 웹 프로토타입입니다.  
이름: **나 + 길로 / 나아가다** — 나를 알고, 나의 길로 나아가다.

## 데모 흐름

1. **질문(홈)** — 검색, 카테고리 칩, 실시간 Top Question, 질문 카드
2. **서브질문** — AI(페페)가 제안한 2개 중 선택
3. **AI 대화** — 미래의 나(페페)와 메시지 교환
4. **질문 탐색 완료** → **영수증**(기회비용) + **나의 로드맵**
5. **도감** — localStorage에 저장된 결과 다시 보기

## 구조

```
NARO/
├── .github/workflows/static.yml   # GitHub Pages 자동 배포
├── dist/
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## 로컬 실행

`dist` 폴더를 정적 서버로 열면 됩니다.

```bash
cd dist
python3 -m http.server 8080
# → http://localhost:8080
```

또는 VS Code / Cursor의 Live Preview로 `dist/index.html`을 여세요.

## OpenAI 실연동

`dist/script.js` 상단:

```js
const USE_MOCK_API = false;
const OPENAI_API_KEY = "sk-...";
const OPENAI_MODEL = "gpt-3.5-turbo"; // 또는 gpt-4
```

- 기본값은 **Mock API** (`USE_MOCK_API = true`)라서 키 없이 전체 플로우를 체험할 수 있습니다.
- **GitHub Pages에 API 키를 커밋하지 마세요.** 공개 배포 시 서버리스 프록시를 권장합니다.

## GitHub Pages 배포

1. 이 저장소를 GitHub에 푸시
2. Settings → Pages → Source: **GitHub Actions**
3. `main` 브랜치 push 시 `dist/` 내용이 자동 배포됩니다 (`.github/workflows/static.yml`)

```bash
git add .
git commit -m "Add NARO web prototype"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

## 기술

- Vanilla HTML / CSS / JS SPA
- Mock AI + OpenAI Chat Completions 교체 지점 포함
- 도감 데이터: `localStorage` (`naro_dictionary_entries`)
