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

$previousStory = $data['previousStory'] ?? '';
$previousTitle = $data['previousTitle'] ?? '';
// 원글의 모델 정보를 받아서 사용 (숫자 형식도 지원)
$model = $data['model'] ?? 'claude-3-7';
// 숫자 형식('3.7', '4', '4.5')을 표준 형식으로 변환
if ($model === '3.7') {
    $model = 'claude-3-7';
} elseif ($model === '4') {
    $model = 'claude-4';
} elseif ($model === '4.5') {
    $model = 'claude-4-5';
}
// 유효하지 않은 모델명이면 기본값 사용
if (!in_array($model, ['claude-3-7', 'claude-4', 'claude-4-5'])) {
    $model = 'claude-3-7';
}
$level = $data['level'] ?? '2';

// 제목에서 기존 번호 추출 및 증가
function getNextTitle($previousTitle) {
    // (숫자) 패턴 찾기
    if (preg_match('/^(.+?)\((\d+)\)$/', $previousTitle, $matches)) {
        // 이미 번호가 있는 경우: 제목 + 번호 증가
        $baseTitle = $matches[1];
        $currentNumber = intval($matches[2]);
        $nextNumber = $currentNumber + 1;
        return $baseTitle . '(' . $nextNumber . ')';
    } else {
        // 번호가 없는 경우: 원래 제목 + (2)
        return $previousTitle . '(2)';
    }
}

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

// 이어쓰기 전용 시스템 프롬프트
$continuePrompt = '너는 인터넷 커뮤니티 게시판 유저야. 이전에 작성했던 이야기의 후속편을 작성해야 해.

# 지시사항
- 이전 이야기의 분위기와 말투, 캐릭터 성격을 그대로 유지하면서 자연스럽게 이어지는 후속 이야기를 작성하세요.
- 제목은 작성하지 마세요. 본문만 작성하면 됩니다.
- 이전 이야기에서 등장했던 인물들을 그대로 사용하되, 필요하면 새로운 인물을 추가해도 됨.
- 이전 이야기의 결말 이후 시간이 지난 뒤의 이야기거나, 그 이후의 사건을 다뤄.
- 분량은 400~600자 정도로 작성해.

' . ($levelConstraints[$level] ?? $levelConstraints['2']) . '

# 대사
- 다른 사람의 대사 앞에 (인물)"대사"로 표시한다. (ex. 할아버지, 50대 여성, 아저씨, 여학생)
- 화자, "나"의 대사는 (인물)없이 그냥 "쌍따옴표"로만 표시하세요.
- 긴 대사를 여러줄로 나누는 경우, 쌍따옴표로 마무리하고 다음줄로 나타낸다.

## 대사 예시
(아가씨)"안녕하세요. 저는" 
(아가씨)"옆집사는 사람인데요."
"네, 근데 무슨 일이세요?"
(아가씨)"드릴 말씀이 있어서요."

# 이전 이야기
아래는 네가 이전에 작성했던 이야기야. 이 이야기를 바탕으로 후속편을 작성해줘.

';

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

$messages = [
    ['role' => 'user', 'content' => $previousStory]
];

// system 메시지를 messages 배열에 추가
array_unshift($messages, ['role' => 'system', 'content' => $continuePrompt]);

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
        exit;
    }
    
    $gpt_result = json_decode($gpt_response, true);
    
    // PHP 오류 출력 방지
    error_reporting(0);
    
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
    
    // 제목 생성 (이전 제목 기반으로 번호 추가)
    $nextTitle = getNextTitle($previousTitle);
    
    // 제목을 본문 앞에 추가
    $full_content = $nextTitle . "\n" . $claude_content;
    
    // 최종 콘텐츠에 분석 결과 추가
    $final_content = $full_content . "\n\n" . $analysis_text;
    
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
            'title' => $nextTitle,
            'level' => $level,
            'model' => $standardized_model === 'claude-3-7' ? '3.7' : 
                       ($standardized_model === 'claude-4' ? '4' : 
                       ($standardized_model === 'claude-4-5' ? '4.5' : '3.7')),
            'isContinuation' => true
        ],
        'analysis' => $analysis_json,
        'full_response' => [
            'claude' => $result,
            'gpt' => $gpt_result
        ]
    ];
    
    
    // JSON 인코딩 전에 데이터 유효성 확인
    $json_data = json_encode($response_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    // JSON 인코딩 오류 처리
    if (json_last_error() !== JSON_ERROR_NONE) {
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'JSON 인코딩 오류: ' . json_last_error_msg(),
            'partial_content' => substr($claude_content, 0, 1000) . '...'
        ]);
        exit;
    }
    
    header('Content-Type: application/json');
    echo $json_data;
}
?>

