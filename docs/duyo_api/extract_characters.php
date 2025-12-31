<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// POST 요청 처리
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// 입력 데이터 받기
$input = json_decode(file_get_contents('php://input'), true);

// OpenRouter API 키 필수 입력
if (empty($input['_openrouter_key'])) {
    http_response_code(400);
    echo json_encode(['error' => 'OpenRouter API 키가 필요합니다.']);
    exit;
}
$openrouterApiKey = $input['_openrouter_key'];

$story_content = $input['story'] ?? '';

if (empty($story_content)) {
    http_response_code(400);
    echo json_encode(['error' => 'Story content is required']);
    exit;
}

// GPT-4로 등장인물 분석 (원래 로직과 동일)

// 정규식을 사용하여 "(xx) "" 패턴의 문자열만 추출하고 중복 제거
preg_match_all('/\(([^)]+)\)\s*"/', $story_content, $matches);
$characters = array_unique($matches[1]);

// 등장인물 목록을 정리
$character_list = '';
foreach ($characters as $character) {
    $character_list .= "- ($character)\n";
}

// GPT 시스템 프롬프트 설정 (기존과 동일)
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

// OpenRouter API 호출
$curl = curl_init();
curl_setopt_array($curl, [
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
            ['role' => 'user', 'content' => $story_content]  // 기존과 동일하게 전체 스토리 전달
        ]
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
$httpcode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($err) {
    http_response_code(500);
    echo json_encode([
        'error' => 'API request failed',
        'details' => $err
    ]);
    exit;
}

if ($httpcode !== 200) {
    http_response_code($httpcode);
    echo json_encode([
        'error' => 'API returned error',
        'details' => json_decode($response, true)
    ]);
    exit;
}

// 응답 파싱
$result = json_decode($response, true);

if (!isset($result['choices'][0]['message']['content'])) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid API response',
        'details' => $result
    ]);
    exit;
}

$analysis = $result['choices'][0]['message']['content'];

// 등장인물 정보 추출 및 구조화
$character_info = [];
$character_details = [];

// 정규식으로 등장인물 정보 파싱
if (preg_match_all('/\((.*?)\)\s*:\s*\((.*?)\)/i', $analysis, $matches, PREG_SET_ORDER)) {
    foreach ($matches as $match) {
        $name = trim($match[1]);
        $traits = trim($match[2]);
        
        // traits 파싱 (기존과 동일하게 mood1, mood2, age, sex만)
        $trait_parts = array_map('trim', explode(',', $traits));
        
        $character_data = [
            'name' => $name,
            'raw_traits' => $traits
        ];
        
        // 상세 정보 분류 (가능한 경우)
        if (count($trait_parts) >= 4) {
            $character_data['mood1'] = $trait_parts[0] ?? '';
            $character_data['mood2'] = $trait_parts[1] ?? '';
            $character_data['age'] = $trait_parts[2] ?? '';
            $character_data['sex'] = $trait_parts[3] ?? '';
        }
        
        $character_info[$name] = $traits;
        $character_details[] = $character_data;
    }
}

// 응답 구성
$response_data = [
    'success' => true,
    'characters' => $character_info,
    'character_details' => $character_details,
    'extracted_names' => array_values($characters ?? []),  // 자동 추출된 등장인물 이름 목록
    'raw_analysis' => $analysis,
    'usage' => [
        'prompt_tokens' => $result['usage']['prompt_tokens'] ?? 0,
        'completion_tokens' => $result['usage']['completion_tokens'] ?? 0,
        'total_tokens' => ($result['usage']['prompt_tokens'] ?? 0) + ($result['usage']['completion_tokens'] ?? 0)
    ],
    'model' => 'openai/gpt-4o-mini',
    'timestamp' => date('Y-m-d H:i:s')
];

// JSON 응답 전송
echo json_encode($response_data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
