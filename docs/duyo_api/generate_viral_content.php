<?php
header('Content-Type: application/json; charset=utf-8');

// CORS 헤더 설정
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// POST 요청만 허용
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// 입력 데이터 받기
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// OpenRouter API 키 필수 입력
if (empty($data['_openrouter_key'])) {
    echo json_encode(['error' => 'OpenRouter API 키가 필요합니다.']);
    exit();
}
$openrouterApiKey = $data['_openrouter_key'];

if (!isset($data['storyContent']) || empty($data['storyContent'])) {
    echo json_encode(['error' => '스토리 내용이 필요합니다.']);
    exit();
}

$storyContent = $data['storyContent'];

// 시스템 프롬프트 구성
$systemPrompt = "입력한 숏폼 콘텐츠를 위한 SNS 설명과 해시태그를 작성해주세요.

# 설명
1. 시청자의 흥미를 끌 수 있는 매력적인 바이럴 문구
2. 인스타그램/유튜브 숏츠/틱톡 등에 적합한 스타일
3. 이모지를 적절히 활용 (과도하게 사용하지 마세요)
4. 댓글 유도 문구

# 해시태그
1. 15-20개의 해시태그 생성
2. 숏폼과 관련있는 해시태그로만 구성하세요.
3. 해시태그를 공백으로 구분하여 한 줄로 작성

# 출력 형식

[설명 300자]

[#해시태그1 #해시태그2 #해시태그3 ...]
";

// OpenRouter API 요청 데이터
$requestData = [
    'model' => 'openai/gpt-4o',
    'messages' => [
        [
            'role' => 'system',
            'content' => $systemPrompt
        ],
        [
            'role' => 'user',
            'content' => $storyContent
        ]
    ],
    'temperature' => 0.8,
    'max_tokens' => 1000
];

// cURL 초기화 및 실행
$ch = curl_init('https://openrouter.ai/api/v1/chat/completions');

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $openrouterApiKey,
        'HTTP-Referer: https://yourdomain.com',
        'X-Title: Viral Content Generator'
    ],
    CURLOPT_POSTFIELDS => json_encode($requestData),
    CURLOPT_TIMEOUT => 60,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

curl_close($ch);

// 오류 처리
if ($curlError) {
    echo json_encode(['error' => 'API 요청 실패: ' . $curlError]);
    exit();
}

if ($httpCode !== 200) {
    $errorResponse = json_decode($response, true);
    echo json_encode([
        'error' => 'API 오류 (HTTP ' . $httpCode . ')',
        'details' => $errorResponse,
        'raw_response' => $response
    ]);
    exit();
}

// 응답 파싱
$responseData = json_decode($response, true);

if (!isset($responseData['choices'][0]['message']['content'])) {
    echo json_encode([
        'error' => '응답 파싱 실패',
        'raw_response' => $responseData
    ]);
    exit();
}

$generatedContent = trim($responseData['choices'][0]['message']['content']);

// 설명과 해시태그 분리
$description = '';
$hashtags = '';

// [설명]과 [해시태그] 태그로 분리
if (preg_match('/\[설명\](.*?)\[해시태그\](.*)/s', $generatedContent, $matches)) {
    $description = trim($matches[1]);
    $hashtags = trim($matches[2]);
} else {
    // 태그가 없는 경우 줄바꿈으로 분리 시도
    $lines = explode("\n", $generatedContent);
    $isHashtag = false;
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        // 해시태그 섹션 시작 감지
        if (strpos($line, '#') === 0 || $isHashtag) {
            $isHashtag = true;
            $hashtags .= ($hashtags ? ' ' : '') . $line;
        } else if (!$isHashtag && strpos($line, '[') !== 0) {
            $description .= ($description ? "\n" : '') . $line;
        }
    }
}

// 결과 검증
if (empty($description) && empty($hashtags)) {
    // 파싱 실패 시 전체 내용을 설명으로 처리
    $description = $generatedContent;
}

// 성공 응답
echo json_encode([
    'success' => true,
    'description' => $description,
    'hashtags' => $hashtags,
    'model' => 'openai/gpt-4o',
    'raw_content' => $generatedContent,
    'token_info' => [
        'input_tokens' => $responseData['usage']['prompt_tokens'] ?? 0,
        'output_tokens' => $responseData['usage']['completion_tokens'] ?? 0
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

