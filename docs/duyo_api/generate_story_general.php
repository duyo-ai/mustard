<?php
// 파일 최상단에 시간대 설정 추가
date_default_timezone_set('Asia/Seoul');

// 최대 실행 시간을 180초(3분)으로 설정
set_time_limit(180);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// API를 통해 호출되었는지 확인 (빠른 처리)
if (isset($GLOBALS['_API_REQUEST_DATA'])) {
    $data = $GLOBALS['_API_REQUEST_DATA'];
} else {
    $data = json_decode(file_get_contents('php://input'), true);
}

// OpenRouter API 키 필수 입력
if (empty($data['_openrouter_key'])) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'OpenRouter API 키가 필요합니다.']);
    exit;
}
$openrouterApiKey = $data['_openrouter_key'];

$topic = $data['topic'] ?? '';
$genre = $data['genre'] ?? '';
$toneType = $data['toneType'] ?? '기본';
$splitEnding = $data['splitEnding'] ?? false;
$level = $data['level'] ?? '2'; // 기본값은 중간맛(2)
$length = $data['length'] ?? 'medium'; // 기본값을 medium으로 변경
$model = isset($data['model']) && in_array($data['model'], ['claude-3-7', 'claude-4', 'claude-4-5']) ? $data['model'] : 'claude-3-7';

$tonePrompts = [
    '자동' => "",  // 기본 톤은 빈 문자열로 설정
    '음슴체' => "나레이션은 음슴체로 말해야 한다. \n1. 문장 끝에 '~음', '~함', ~'임'을 붙임\n2. 존댓말은 사용하지 않음\n3. 구어체를 적극 활용함",
    '해요체' => "나레이션은 해요체로 말해야 한다. \n- 해요체를 사용합니다.\n- 예: ~해요, ~이에요, ~네요\n- 구어체를 적극 활용하세요.",
    '다나까' => "나레이션은 다나까로 말해야 한다. \n- 문장 끝에 '~다', '~나', '~까' 등을 자주 사용합니다.\n- 때때로 '??', '!!' 등의 과도한 문장부호를 사용합니다.\n- 구어체를 적극 활용합니다.",
    '사극체' => "나레이션은 사극체로 말해야 한다.\n- ~하옵니다, ~하였사옵니다, ~하오니 등의 사극체를 사용하시오.\n- 격식 있는 표현과 함께 때에 따라 해학적인 표현도 섞어 쓰시오.\n- 문장의 끝에는 '~이옵니다', '~사옵니다', '~하오' 등을 사용하시오.\n- 현대 커뮤니티 썰이지만, 말투만 사극입니다.",
    '상남자' => "나레이션은 상남자처럼 말해야 한다.\n- 문장을 짧고 강하게 끊어서 말해.\n- 존댓말은 쓰지 않고 반말을 사용해.\n- 확신에 찬 어조로 말해. 망설이지 마.\n- 가끔 '브라더', '형님들' 같은 호칭을 사용해.\n- 문장을 '~다', '~지', '~군' 등으로 끝내.\n- 감탄사나 의성어를 적절히 사용해.",
    '경상도체' => "나레이션은 경상도체로 말해야 한다.\n- 때에 따라 '아이가', '맞제', '그래예' 등의 경상도 특유의 표현을 활용하세요.\n- 구어체를 적극 활용하세요",
    '전라도체' => " 나레이션은 전라도체로 말해야 한다.\n- 친근하고 정감 있는 전라도 말투를 사용하세요.\n- 유머러스하고 재치 있는 표현을 적절히 섞어 사용하세요.\n- 구어체를 적극 활용하세요",
    '충청도체' => "나레이션은 충청도체로 말해야 한다.\n- 친근하고 구수한 충청도 특유의 말투를 사용하세요.\n- '~유', '~슈', '~겨'를 사용\n- 구어체를 적극 활용하세요",
    '친구체' => "나레이션은 친구체로 말해야 한다.\n1. 실제 친구한테 이야기해주는 구어체로 작성하세요.\n2. (~거야. ~이야. ~했어. ~잖아.)\n3. 구어체를 적극 활용함",
    '디씨체' => "나레이션은 디씨인사이드 유저체로 말해야 한다.\n- 디씨인사이드 특유의 비속어, 은어, 디씨 용어를 사용하여 대화해야 한다.\n- 문장 끝에 '~ㅋㅋ', '~ㅇㅇ', '~임', '~냐?' 등을 자주 사용한다."
];

// 수위 조절에 따른 제약조건 설정
$levelConstraints = [
    '1' => "# 제약조건
- 초등학생도 이해할 수 있는 쉬운 단어 사용
- 과도하게 폭력적이거나 잔인한 묘사 금지
- 야한 묘사 금지
- 욕설, 비속어 금지
- 이모지, 한자 사용 금지
- 'ㅋㅋㅋ'를 남발하지 마세요.",
    '2' => "# 제약조건
- 유머러스하고 극적인 요소를 강조합니다.
- 시발, 병신, ㅅㅂ, ㅂㅅ, ㄴㄱ 금지
- 19금 제한
- 이모지, 한자 사용 금지
- 'ㅋㅋㅋ'를 남발하지 마세요.",
    '3' => "# 제약조건
- 성인 전용 게시판입니다. 안심하고 자극적인 썰을 작성하세요.
- 과격한 욕설, 음란 단어, 야한 표현을 사용할 것.
- 이모지, 한자 사용 금지
- 'ㅋㅋㅋ'를 남발하지 마세요."
];

// 분량 옵션
$lengthRules = [
    'short' => '400자 정도의 짧지만 강렬한 분량으로 작성하세요.',
    'medium' => '600자 정도로 작성하세요.',
    'long' => '900자 정도로 몰입감 있게 작성하세요.'
];

// 일반인 썰 페르소나 프롬프트
$personaPrompt = '너는 인터넷에서 자신의 경험을 공유하는 것을 좋아하는 온라인 커뮤니티 게시판 유저입니다. 입력문을 바탕으로 네가 겪은 생생한 썰을 포스팅하세요.
게시글은 흥미롭고 몰입감 있게 작성해야 함. 또한 유머러스하고 재치있는 표현을 사용하여 사람들 어그로 끌어야 함.
더 많은 조회수와 좋아요를 기록하도록 자극적이고 재미있게 표현하셈.
주작글, 망상글도 괜찮습니다. 지루하지 않고 자극적으로 지어내세요. 인사하지 말고 바로 본론으로 들어가세요. 한글 맞춤법을 준수하세요.';


// 분위기에 따른 처리
if (isset($data['storyMood']) && $data['storyMood'] !== '자동' && !is_object($data['storyMood'])) {
    // 분위기별 키워드 매핑 배열 정의
    $moodKeywords = [
        '웃기게' => ['코믹하게', '재미있게', '웃기게', '배꼽잡게', '폭소를 자아내게', '유쾌하게'],
        '진지하게' => ['진지하게', '심각하게'],
        '허무하게' => ['허무하게'],
        '무섭게' => ['공포스럽게', '오싹하게', '으스스하게', '등골이 서늘하게', '불안하게', '섬뜩하게', '소름끼치게'],
        '슬프게' => ['슬프게', '서글프게', '가슴 아프게'],
        '설레게' => ['설레게'],
        '감동적으로' => ['감동적으로', '감명깊게']
    ];
    
    // 선택된 분위기에 해당하는 키워드 배열 가져오기
    $selectedMoodKeywords = $moodKeywords[$data['storyMood']] ?? [$data['storyMood']];
    
    // 랜덤하게 키워드 선택
    $randomMoodKeyword = $selectedMoodKeywords[array_rand($selectedMoodKeywords)];
    
    // 클라이언트에서 전달받은 additionalKeyword 사용
    $additionalKeyword = $data['additionalKeyword'] ?? '';
    
    // userContent 구성
    $userContent = "";
    
    // 장르 섹션
    if (!empty($genre) || !empty($additionalKeyword)) {
        $userContent .= "== 장르 ==\n";
        if (!empty($genre) && !empty($additionalKeyword)) {
            $userContent .= "$genre, $additionalKeyword\n\n";
        } elseif (!empty($genre)) {
            $userContent .= "$genre\n\n";
        } else {
            $userContent .= "$additionalKeyword\n\n";
        }
    }
    
    // 주제 섹션
    $userContent .= "== 주제 ==\n$topic";
    
    // 분위기 키워드를 메타데이터에 저장하기 위해 변수에 저장
    $storyMoodValue = $randomMoodKeyword;
} else {
    $storyMoodValue = '자동';
    
    // 분위기가 "자동"일 때는 additionalKeyword 값을 빈 문자열로 설정
    $additionalKeyword = '';
    
    // userContent 구성
    $userContent = "";
    
    // 장르 섹션
    if (!empty($genre)) {
        $userContent .= "== 장르 ==\n$genre\n\n";
    }
    
    // 주제 섹션
    $userContent .= "== 주제 ==\n$topic";
}


// 이야기 설정 섹션 구성
$storySettingsSection = "\n\n# 이야기 설정";

// 화자 설정 추가
if (($data['narratorAge'] ?? '자동') !== '자동' || ($data['narratorGender'] ?? '자동') !== '자동') {
    $storySettingsSection .= "\n- 화자 : " . ($data['narratorAge'] ?? '20대') . ' ' . ($data['narratorGender'] ?? '남성');
}

// 이야기 분위기 추가
if ($storyMoodValue !== '자동') {
    $storySettingsSection .= "\n- 이야기는 " . $storyMoodValue . " 전개해주세요.";
}

// 결말 스타일 추가
if (($data['endingStyle'] ?? '자동') !== '자동') {
    $storySettingsSection .= "\n- 결말은 " . ($data['endingStyle'] ?? '해피엔딩') . "으로 마무리해주세요.";
}

$prompt = $personaPrompt . 
$storySettingsSection . '

' . ($levelConstraints[$level] ?? $levelConstraints['2']) . '

# 분량
- ' . ($lengthRules[$length] ?? $lengthRules['medium']) . '



# 대사' .
// 등장인물 수 제한이 체크되어 있을 때만 추가
(($data['limitCharacters'] ?? true) ? "\n- 등장인물 수는 3명 이하로 제한한다." : "") . '
- 다른 사람의 대사 앞에 (인물)"대사"로 표시한다. (ex. 할아버지, 50대 여성, 아저씨, 여학생)
- 화자, "나"의 대사는 (인물)없이 그냥 "쌍따옴표"로만 표시하세요.
- 긴 대사를 여러줄로 나누는 경우, 쌍따옴표로 마무리하고 다음줄로 나타낸다.

## 대사 예시
(아가씨)"안녕하세요. 저는" 
(아가씨)"옆집사는 사람인데요."
"네, 근데 무슨 일이세요?"
(아가씨)"드릴 말씀이 있어서요."

' .
    ($splitEnding ? '

# 결말 추가 규칙
- 결말을 A,B로 나누어 구성하기 위해, 특정 장면부터는 <결말A>, <결말B> 형식으로 표시하며 두 가지 결말을 다 보여주세요.
- 결말은 2개 모두 보여야합니다. A를 먼저 출력하고, 그 다음 B를 출력하세요.' : '') . 
    ($data['includeQuestions'] ? '

# 마무리 질문
- 마지막 장면은 질문으로 구성하여 자연스럽게 마무리하세요.
- ex. "여러분은 어떻게 생각하세요?", "누가 더 잘못했을까요?", "님들이라면 어떻게 함?"' : '') . 

(!empty($data['additionalRequest']) ? '
# 추가 요청사항
' . $data['additionalRequest'] : '') . '

# 말투
나레이션 말투와 "인물 대사"의 말투를 구분하여 작성해야 합니다. 등장하는 인물의 말투는 각 인물의 특성에 따라 자연스럽게 작성해야 합니다. 아래는 나레이션 말투입니다.
' . ($tonePrompts[$toneType] ?? '') . '

#이어쓰기
제목: (짧고 축약된 어그로성 제목을 작성해. 결말 스포일러 하지 마. 괄호도 쓰지마.)';

// 모델명 표준화
$standardized_model = '';
$api_model = '';
if ($model === 'claude-3-7' || $model === '3.7') {
    $standardized_model = 'claude-3-7';
    $api_model = 'anthropic/claude-3.7-sonnet';
} elseif ($model === 'claude-4') {
    $standardized_model = 'claude-4';
    $api_model = 'anthropic/claude-sonnet-4';
} elseif ($model === 'claude-4-5') {
    $standardized_model = 'claude-4-5';
    $api_model = 'anthropic/claude-sonnet-4.5';
} else {
    $standardized_model = 'claude-3-7';
    $api_model = 'anthropic/claude-3.7-sonnet';
}

$curl = curl_init();

$messages = [['role' => 'user', 'content' => $userContent]];

// 기본적으로 "제목:" 메시지 추가
$messages[] = ['role' => 'assistant', 'content' => "제목:"];

// 🔞 버튼이 활성화되었을 때만 자극적인 prefill 추가
if ($data['isAdultContent'] ?? false) {  // 클라이언트에서 전달받은 isAdultContent 값 확인
    // 이미 추가된 메시지를 음란썰로 변경
    $messages[1] = ['role' => 'assistant', 'content' => "제목: [음란썰]"];
}

// system 메시지를 messages 배열에 추가
array_unshift($messages, ['role' => 'system', 'content' => $prompt]);

curl_setopt_array($curl, [
    CURLOPT_URL => "https://openrouter.ai/api/v1/chat/completions",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => json_encode([
        'model' => $api_model,
        'max_tokens' => 8192,
        'temperature' => 1,
        'messages' => $messages
    ]),
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "Authorization: Bearer " . $openrouterApiKey
    ],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
    header('Content-Type: application/json');
    echo json_encode(['error' => $err]);
} else {
    $result = json_decode($response, true);
    
    error_log('Claude API Response: ' . print_r($response, true));
    
    if (!$result || isset($result['error'])) {
        header('Content-Type: application/json');
        echo json_encode([
            'error' => $result['error']['message'] ?? 'Invalid JSON response',
            'raw_response' => $response
        ]);
        exit;
    }
    
    // AI 응답 텍스트 추출 및 final_content 정의
    $claude_content = $result['choices'][0]['message']['content'] ?? '';
    $final_content = $claude_content;  // 초기 final_content 설정
    
    if (empty($claude_content)) {
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Empty response from API',
            'raw_response' => $response
        ]);
        exit;
    }
    
    // GPT-4로 등장인물 분석
    
    // 정규식을 사용하여 "(xx) "" 패턴의 문자열만 추출하고 중복 제거
    preg_match_all('/\(([^)]+)\)\s*"/', $claude_content, $matches);
    $characters = array_unique($matches[1]);
    
    // 등장인물 목록을 정리
    $character_list = '';
    foreach ($characters as $character) {
        $character_list .= "- ($character)\n";
    }
    
    $gpt_system = '#지시문
입력된 내용을 바탕으로 아래 내용을 한글로 작성해주세요.
- ex. (여친): (차분한, 세련된, 20대, 여)
- 모든 (등장인물)을 빠짐없이 표시하세요.
- 반드시 주어진 등장인물 이름을 사용해야합니다.
- 다른 부연설명을 작성하지 마세요.

# 출력형식
- (등장인물1) : (mood1, mood2, age, sex)
- (등장인물2) : (mood1, mood2, age, sex)
- (등장인물3) : (mood1, mood2, age, sex)
...' . $character_list;

    $gpt_curl = curl_init();
    curl_setopt_array($gpt_curl, [
        CURLOPT_URL => "https://openrouter.ai/api/v1/chat/completions",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING => "",
        CURLOPT_MAXREDIRS => 10,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST => "POST",
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'openai/gpt-4o-mini',
            'messages' => [
                ['role' => 'system', 'content' => $gpt_system],
                ['role' => 'user', 'content' => $claude_content]
            ]
        ]),
        CURLOPT_HTTPHEADER => [
            "Content-Type: application/json",
            "Authorization: Bearer " . $openrouterApiKey
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
    ]);

    $gpt_response = curl_exec($gpt_curl);
    $gpt_err = curl_error($gpt_curl);
    curl_close($gpt_curl);

    if ($gpt_err) {
        header('Content-Type: application/json');
        echo json_encode([
            'error' => $gpt_err,
            'claude_response' => $result,
            'gpt_response' => null
        ]);
    } else {
        $gpt_result = json_decode($gpt_response, true);
        
        // PHP 오류 출력 방지
        error_reporting(0);
        
        try {
            // GPT 분석 결과 추출
            $gpt_analysis = $gpt_result['choices'][0]['message']['content'] ?? '분석 실패';
            
            // 등장인물 정보 추출
            $character_info = [];
            if (preg_match_all('/\((.*?)\)\s*:\s*\((.*?)\)/i', $gpt_analysis, $char_matches, PREG_SET_ORDER)) {
                foreach ($char_matches as $match) {
                    $character_info[$match[1]] = $match[2];
                }
            }
            
            // 분석 결과를 구조화된 JSON으로 정리
            $analysis_json = [
                'characters' => $character_info
            ];
            
            // 분석 결과를 텍스트 형식으로 추가
            $analysis_text = "=== GPT 분석 결과 ===\n\n";
            
            // 등장인물 정보 추가
            foreach ($character_info as $char => $traits) {
                $analysis_text .= "- ($char) : ($traits)\n";
            }
            
            // 최종 콘텐츠에 분석 결과 추가
            $final_content = $claude_content . "\n\n" . $analysis_text;
            
            // 시간 정보 생성
            $timestamp = date('YmdHis');
            
            // 작업 ID 생성 (unixstamp + 랜덤 6자리)
            $job_id = time() . sprintf('%06d', mt_rand(0, 999999));
            
            // 응답 데이터 구성
            $response_data = [
                'job_id' => $job_id,
                'content' => $final_content,
                'token_info' => [
                    'claude' => [
                        'input_tokens' => $result['usage']['input_tokens'] ?? 0,
                        'output_tokens' => $result['usage']['output_tokens'] ?? 0
                    ],
                    'gpt' => [
                        'input_tokens' => $gpt_result['usage']['prompt_tokens'] ?? 0,
                        'output_tokens' => $gpt_result['usage']['completion_tokens'] ?? 0
                    ]
                ],
                'metadata' => [
                    'timestamp' => $timestamp,
                    'title' => strtok($claude_content, "\n"),
                    'genre' => $genre,
                    'topic' => $topic,
                    'level' => $level,
                    'model' => $standardized_model === 'claude-3-7' ? '3.7' : 
                               ($standardized_model === 'claude-4' ? '4' : 
                               ($standardized_model === 'claude-4-5' ? '4.5' : '3.7')),
                    // 사용자 옵션 추가
                    'toneType' => $toneType,
                    'splitEnding' => $splitEnding,
                    'length' => $length,
                    'includeComments' => $data['includeComments'] ?? false,
                    'includeQuestions' => $data['includeQuestions'] ?? false,
                    'isAdultContent' => $data['isAdultContent'] ?? false,
                    'storyMood' => $storyMoodValue,
                    'additionalKeyword' => $additionalKeyword, // 추가 키워드 정보 포함
                    'endingStyle' => $data['endingStyle'] ?? '자동',
                    'narratorAge' => $data['narratorAge'] ?? '자동',
                    'narratorGender' => $data['narratorGender'] ?? '자동',
                    'personaType' => '일반인 썰'
                ],
                'analysis' => $analysis_json,
                'full_response' => [
                    'claude' => $result,
                    'gpt' => $gpt_result
                ],
                'debug_info' => [
                    'user_content_sent_to_claude' => $userContent,
                    'additional_keyword_received' => $data['additionalKeyword'] ?? 'none'
                ]
            ];
            
            // 디버깅 로그 추가
            error_log('응답 메타데이터: ' . json_encode($response_data['metadata']));
            
            // 기존 응답을 받은 후, 댓글 생성이 요청된 경우 추가 GPT 호출
            if ($data['includeComments'] ?? false) {
                $comment_system = '너는 디씨인사이드 게시판의 댓글러들이야. 
입력된 게시글에 대해 다양한 반응의 댓글을 달아줘.
재미있고 현실감 있는 댓글을 작성해야 해.

# 제약조건
- 유머러스하고 재치있는 댓글로 작성할 것.
- 비꼬는 댓글도 포함할 것.
- 억지로 개그를 하거나 언어유희를 하지말 것.
- 초성과 이모티콘은 적절히 사용해도 됨
- 댓글 갯수는 5~6개 정도
- 함,임,음과 같은 음슴체를 사용할 것

# 출력형식
=== 댓글 ===
ㅇㅇ | 추천 23
(댓글 내용)

ㅇㅇ([ip 주소를 가상으로 출력]) | 추천 12
(댓글 내용)

작성자 | 추천 8
(댓글 내용)

닉네임 | 추천 5
(댓글 내용)
...

# 규칙
1. 추천수는 댓글의 인기도를 반영하여 1~50 사이로 설정
2. 댓글은 2줄을 넘지 않도록 함
3. ip는 111.***, 123.*** 같은 형식으로 표시';

                $comment_curl = curl_init();
                curl_setopt_array($comment_curl, [
                    CURLOPT_URL => "https://openrouter.ai/api/v1/chat/completions",
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_ENCODING => "",
                    CURLOPT_MAXREDIRS => 10,
                    CURLOPT_TIMEOUT => 120,
                    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                    CURLOPT_CUSTOMREQUEST => "POST",
                    CURLOPT_POSTFIELDS => json_encode([
                        'model' => 'openai/gpt-4o',
                        'messages' => [
                            ['role' => 'system', 'content' => $comment_system],
                            ['role' => 'user', 'content' => $claude_content]
                        ]
                    ]),
                    CURLOPT_HTTPHEADER => [
                        "Content-Type: application/json",
                        "Authorization: Bearer " . $openrouterApiKey
                    ],
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_SSL_VERIFYHOST => 0,
                ]);

                $comment_response = curl_exec($comment_curl);
                $comment_err = curl_error($comment_curl);
                curl_close($comment_curl);

                if ($comment_err) {
                    error_log('댓글 생성 API 오류: ' . $comment_err);
                } else {
                    $comment_result = json_decode($comment_response, true);
                    if (isset($comment_result['error'])) {
                        error_log('댓글 생성 응답 오류: ' . json_encode($comment_result['error']));
                    }
                    if (isset($comment_result['choices'][0]['message']['content'])) {
                        // 댓글을 최종 콘텐츠에 추가
                        $final_content .= "\n\n" . $comment_result['choices'][0]['message']['content'];
                        
                        // 토큰 정보에 댓글 생성 토큰 추가
                        $response_data['token_info']['comments'] = [
                            'input_tokens' => $comment_result['usage']['prompt_tokens'] ?? 0,
                            'output_tokens' => $comment_result['usage']['completion_tokens'] ?? 0
                        ];
                        
                        // 전체 응답에 댓글 응답 추가
                        $response_data['full_response']['comments'] = $comment_result;
                        
                        // content도 업데이트
                        $response_data['content'] = $final_content;
                    } else {
                        error_log('댓글 생성 콘텐츠 없음: ' . $comment_response);
                    }
                }
            }
            
            
            // JSON 인코딩 전에 데이터 유효성 확인
            $json_data = json_encode($response_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            
            // JSON 인코딩 오류 처리
            if (json_last_error() !== JSON_ERROR_NONE) {
                header('Content-Type: application/json');
                echo json_encode([
                    'error' => 'JSON 인코딩 오류: ' . json_last_error_msg(),
                    'partial_content' => substr($final_content, 0, 1000) . '...'
                ]);
                exit;
            }
            
            header('Content-Type: application/json');
            echo $json_data;
            
        } catch (Exception $e) {
            header('Content-Type: application/json');
            echo json_encode([
                'error' => '처리 중 오류 발생: ' . $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}
?>

