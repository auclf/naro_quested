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

## GitHub Pages (공유 링크)

**바로 열기:** https://auclf.github.io/naro_quested/

코드는 요청하신 저장소에도 올라갔습니다: https://github.com/csys348/naro_quested  

`csys348/naro_quested`에서 동일 URL(`https://csys348.github.io/naro_quested/`)로 쓰려면 **저장소 소유자(admin)** 가 한 번만 아래를 켜면 됩니다.

1. https://github.com/csys348/naro_quested/settings/pages  
2. Build and deployment → Source: **GitHub Actions**  
3. 이후 `main` push 또는 Actions에서 workflow 재실행

## 로컬 실행

- Vanilla HTML / CSS / JS SPA
- Mock AI + OpenAI Chat Completions 교체 지점 포함
- 도감 데이터: `localStorage` (`naro_dictionary_entries`)
