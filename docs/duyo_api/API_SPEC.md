# Duyo API 명세서

## 개요

Duyo API는 AI 기반 스토리 생성 및 편집 도구를 제공합니다.

**Base URL:** `/duyo_api/`

**공통 헤더:**
- `Content-Type: application/json`

---

## 1. 스토리 생성 API

### `POST /api.php`

메인 스토리 생성 엔드포인트. 페르소나 타입에 따라 내부적으로 적절한 생성기를 호출합니다.

#### Headers
| 이름 | 필수 | 설명 |
|------|------|------|
| `X-API-Key` | ✅ | Duyo API 인증 키 |
| `X-OpenRouter-Key` | ✅ | OpenRouter API 키 |

#### Request Body
```json
{
  "personaType": "일반인 썰",  // "일반인 썰" | "정보글" | "간접광고"
  "topic": "회사에서 있었던 황당한 일",
  "genre": "알바",           // 선택
  "toneType": "음슴체",      // "자동" | "음슴체" | "해요체" | "다나까" | "사극체" | "상남자" | "경상도체" | "전라도체" | "충청도체" | "친구체" | "디씨체"
  "level": "2",              // "1"(순한맛) | "2"(중간맛) | "3"(매운맛)
  "length": "medium",        // "short" | "medium" | "long"
  "model": "claude-4-5",     // "claude-3-7" | "claude-4" | "claude-4-5"
  "storyMood": "웃기게",     // "자동" | "웃기게" | "진지하게" | "허무하게" | "무섭게" | "슬프게" | "설레게" | "감동적으로"
  "endingStyle": "반전",     // "자동" | "해피엔딩" | "반전" | "여운" | "슬픈" | "훈훈" | "충격"
  "narratorGender": "남성",  // "자동" | "남성" | "여성"
  "narratorAge": "20대",     // "자동" | "10대" | "20대" | "30대" | "40대" | "50대"
  "splitEnding": false,      // 결말 A/B 분기
  "includeComments": false,  // 댓글 포함
  "includeQuestions": false, // 마무리 질문 포함
  "limitCharacters": true,   // 등장인물 수 제한 (3명 이하)
  "isAdultContent": false,   // 성인 콘텐츠
  "adProduct": "ABC 보조제"  // personaType이 "간접광고"일 때 필수
}
```

#### Response
```json
{
  "job_id": "1735012345123456",
  "content": "제목\n\n스토리 내용...\n\n=== GPT 분석 결과 ===\n...",
  "token_info": {
    "claude": { "input_tokens": 1500, "output_tokens": 800 },
    "gpt": { "input_tokens": 500, "output_tokens": 200 },
    "comments": { "input_tokens": 100, "output_tokens": 150 }
  },
  "metadata": {
    "timestamp": "20231228103000",
    "title": "생성된 제목",
    "genre": "알바",
    "topic": "회사에서 있었던 황당한 일",
    "level": "2",
    "model": "4.5",
    "toneType": "음슴체",
    "splitEnding": false,
    "length": "medium",
    "includeComments": false,
    "includeQuestions": false,
    "isAdultContent": false,
    "storyMood": "웃기게",
    "additionalKeyword": ""
  },
  "analysis": {
    "characters": {
      "팀장님": "권위적, 50대, 남"
    }
  },
  "full_response": {
    "claude": { /* Claude API 원본 응답 */ },
    "gpt": { /* GPT API 원본 응답 */ }
  }
}
```

---

## 2. 이어쓰기 API

### `POST /continue_story.php`

기존 스토리의 후속편을 생성합니다.

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "previousStory": "이전 스토리 전체 내용",
  "previousTitle": "이전 제목",
  "model": "claude-4-5",     // "claude-3-7" | "claude-4" | "claude-4-5"
  "level": "2"               // "1" | "2" | "3"
}
```

#### Response
```json
{
  "job_id": "1735012345123456",
  "content": "제목(2)\n\n후속 스토리 내용...\n\n=== GPT 분석 결과 ===\n...",
  "token_info": {
    "claude": { "input_tokens": 2000, "output_tokens": 600 },
    "gpt": { "input_tokens": 400, "output_tokens": 150 }
  },
  "metadata": {
    "timestamp": "20231228103000",
    "title": "제목(2)",
    "level": "2",
    "model": "4.5",
    "isContinuation": true
  },
  "analysis": {
    "characters": {
      "팀장님": "권위적, 50대, 남"
    }
  },
  "full_response": {
    "claude": { /* Claude API 원본 응답 */ },
    "gpt": { /* GPT API 원본 응답 */ }
  }
}
```

---

## 3. 장면 나누기 API

### `POST /split_scene.php`

스토리를 숏폼 영상용 장면 단위로 분할합니다.

**모델:** `x-ai/grok-4-fast` (고정)

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "story": "분할할 스토리 내용"
}
```

#### Response
```json
{
  "success": true,
  "content": "scene 1\n장면 내용...\n\nscene 2\n장면 내용...",
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 1500,
    "total_tokens": 2700
  },
  "model": "x-ai/grok-4-fast",
  "token_info": {
    "input_tokens": 1200,
    "output_tokens": 1500
  }
}
```

---

## 4. 스토리 가공 API (AI 어시스턴트)

### `POST /refine_story.php`

AI 어시스턴트와 대화하며 HOOK, BODY, CTA를 편집합니다.

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "model": "claude-4.5",
  "message": "BODY를 더 재미있게 수정해줘",
  "hookContent": "현재 HOOK 내용",
  "bodyContent": "현재 BODY 내용",
  "ctaContent": "현재 CTA 내용",
  "conversationHistory": [
    { "role": "user", "content": "이전 메시지" },
    { "role": "assistant", "content": "이전 응답" }
  ]
}
```

#### Response
```json
{
  "success": true,
  "response": "수정해드렸습니다!\n\n---HOOK---\n수정된 HOOK 내용\n---HOOK_END---\n\n...",
  "model_used": "claude-4.5"
}
```

> **Note:** AI 응답 내에서 `---HOOK---`, `---BODY---`, `---CTA---` 태그를 사용하여 수정된 콘텐츠를 전달합니다. 클라이언트에서 파싱 필요.

---

## 5. HOOK 생성 API

### `POST /generate_hook.php`

BODY 내용을 기반으로 다양한 유형의 HOOK을 생성합니다.

**모델:** `claude-sonnet-4-5-20250929` (고정)

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "bodyContent": "BODY 스토리 내용",
  "hookType": "질문형"  // "자동" | "질문형" | "충격 사실형" | "대비형" | "스토리 티저형" | "통계 강조형" | "행동 유도형"
}
```

#### Response
```json
{
  "success": true,
  "hooks": {
    "질문형": "생성된 질문형 HOOK",
    "충격 사실형": "생성된 충격 사실형 HOOK",
    "대비형": "생성된 대비형 HOOK",
    "스토리 티저형": "생성된 스토리 티저형 HOOK",
    "통계 강조형": "생성된 통계 강조형 HOOK",
    "행동 유도형": "생성된 행동 유도형 HOOK"
  },
  "raw_response": "== 질문형 ==\n생성된 질문형 HOOK\n\n== 충격 사실형 ==\n...",
  "model_used": "claude-sonnet-4-5-20250929",
  "token_info": {
    "input_tokens": 600,
    "output_tokens": 150
  }
}
```

---

## 6. CTA 생성 API

### `POST /generate_cta.php`

BODY 내용을 기반으로 다양한 유형의 CTA를 생성합니다.

**모델:** `claude-sonnet-4-5-20250929` (고정)

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "bodyContent": "BODY 스토리 내용",
  "ctaType": "참여 유도형"  // "자동" | "참여 유도형" | "구독/팔로우 유형" | "확장 시청 유도형" | "행동 전환형" | "즉각 행동 촉구형"
}
```

#### Response
```json
{
  "success": true,
  "ctas": {
    "참여 유도형": "생성된 참여 유도형 CTA",
    "구독/팔로우 유형": "생성된 구독/팔로우 유형 CTA",
    "확장 시청 유도형": "생성된 확장 시청 유도형 CTA",
    "행동 전환형": "생성된 행동 전환형 CTA",
    "즉각 행동 촉구형": "생성된 즉각 행동 촉구형 CTA"
  },
  "raw_response": "== 참여 유도형 ==\n생성된 참여 유도형 CTA\n\n== 구독/팔로우 유형 ==\n...",
  "model_used": "claude-sonnet-4-5-20250929",
  "token_info": {
    "input_tokens": 600,
    "output_tokens": 150
  }
}
```

---

## 7. 캐릭터 추출 API

### `POST /extract_characters.php`

스토리에서 등장인물을 추출하고 분석합니다.

**모델:** `gpt-4o-mini`

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "story": "분석할 스토리 내용"
}
```

#### Response
```json
{
  "success": true,
  "characters": {
    "팀장님": "권위적, 진지한, 50대, 남",
    "신입": "소심한, 순진한, 20대, 여"
  },
  "character_details": [
    {
      "name": "팀장님",
      "raw_traits": "권위적, 진지한, 50대, 남",
      "mood1": "권위적",
      "mood2": "진지한",
      "age": "50대",
      "sex": "남"
    },
    {
      "name": "신입",
      "raw_traits": "소심한, 순진한, 20대, 여",
      "mood1": "소심한",
      "mood2": "순진한",
      "age": "20대",
      "sex": "여"
    }
  ],
  "extracted_names": ["팀장님", "신입"],
  "raw_analysis": "- (팀장님): (권위적, 진지한, 50대, 남)\n- (신입): (소심한, 순진한, 20대, 여)",
  "usage": {
    "prompt_tokens": 500,
    "completion_tokens": 100,
    "total_tokens": 600
  },
  "model": "openai/gpt-4o-mini",
  "timestamp": "2023-12-28 10:30:00"
}
```

---

## 8. 장소 정보 추출 API

### `POST /get_location.php`

각 장면에 적절한 장소 정보를 추가합니다.

**모델:** `gpt-4o-mini`

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "scenes": [
    "오늘 회사에서 진짜 미친 일을 겪었다.",
    "나는 평범한 회사원인데, 오늘 아침 출근하니까...",
    "팀장님이 부르시더니..."
  ]
}
```

#### Response
```json
{
  "success": true,
  "original_scenes": [
    "오늘 회사에서 진짜 미친 일을 겪었다.",
    "나는 평범한 회사원인데, 오늘 아침 출근하니까...",
    "팀장님이 부르시더니..."
  ],
  "processed_scenes": [
    {
      "location": "회사/사무실",
      "scene": "오늘 회사에서 진짜 미친 일을 겪었다.",
      "full_text": "(회사/사무실) 오늘 회사에서 진짜 미친 일을 겪었다."
    },
    {
      "location": "회사/사무실",
      "scene": "나는 평범한 회사원인데, 오늘 아침 출근하니까...",
      "full_text": "(회사/사무실) 나는 평범한 회사원인데, 오늘 아침 출근하니까..."
    },
    {
      "location": "회사/팀장실",
      "scene": "팀장님이 부르시더니...",
      "full_text": "(회사/팀장실) 팀장님이 부르시더니..."
    }
  ],
  "raw_output": "(회사/사무실) 오늘 회사에서 진짜 미친 일을 겪었다.\n(회사/사무실) 나는 평범한 회사원인데...\n(회사/팀장실) 팀장님이 부르시더니...",
  "token_info": {
    "input_tokens": 300,
    "output_tokens": 150,
    "total_tokens": 450
  },
  "model_used": "gpt-4o-mini"
}
```

---

## 9. 바이럴 콘텐츠 생성 API

### `POST /generate_viral_content.php`

스토리 콘텐츠를 기반으로 SNS용 설명과 해시태그를 생성합니다.

**모델:** `gpt-4o`

#### Request Body
```json
{
  "_openrouter_key": "sk-or-v1-...",
  "storyContent": "숏폼 스토리 내용..."
}
```

#### Response
```json
{
  "success": true,
  "description": "생성된 SNS 설명 (이모지, 댓글 유도 문구 포함)",
  "hashtags": "#해시태그1 #해시태그2 #해시태그3 ...",
  "model": "openai/gpt-4o",
  "raw_content": "전체 AI 응답 원본",
  "token_info": {
    "input_tokens": 500,
    "output_tokens": 200
  }
}
```

---

## 에러 응답

모든 API는 에러 발생 시 다음 형식으로 응답합니다:

```json
{
  "error": "에러 메시지",
  "message": "상세 설명"
}
```

또는 상세 디버그 정보와 함께:

```json
{
  "error": "에러 메시지",
  "raw_response": "API 원본 응답 (디버그용)",
  "details": { /* 추가 정보 */ }
}
```

### HTTP 상태 코드
| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (필수 파라미터 누락 등) |
| 401 | 인증 실패 (API 키 오류) |
| 405 | 허용되지 않는 메소드 |
| 500 | 서버 내부 오류 |

---

## 폴더 구조

```
duyo_api/
├── config.php              # 설정 (API 키)
├── api.php                 # 메인 API 엔드포인트
├── continue_story.php      # 이어쓰기
├── split_scene.php         # 장면 나누기
├── refine_story.php        # 스토리 가공
├── generate_hook.php       # HOOK 생성
├── generate_cta.php        # CTA 생성
├── extract_characters.php  # 캐릭터 추출
├── get_location.php        # 장소 정보 추출
├── generate_viral_content.php  # 바이럴 콘텐츠 생성
├── generate_story_*.php    # 스토리 생성 (내부용)
│
├── pages/                  # 웹 페이지
│   ├── api_test.html       # API 테스트
│   └── refine_story.html   # 스토리 가공
│
└── test/                   # 테스트 페이지
    ├── test_extract_characters.html
    └── test_get_location.html
```
