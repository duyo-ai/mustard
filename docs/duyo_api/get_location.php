<?php
// 파일 최상단에 시간대 설정 추가
date_default_timezone_set('Asia/Seoul');

// 최대 실행 시간을 60초로 설정
set_time_limit(60);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// API를 통해 호출되었는지 확인
if (isset($GLOBALS['_API_REQUEST_DATA'])) {
    $data = $GLOBALS['_API_REQUEST_DATA'];
} else {
    $data = json_decode(file_get_contents('php://input'), true);
}

// OpenRouter API 키 필수 입력
if (empty($data['_openrouter_key'])) {
    echo json_encode(['error' => 'OpenRouter API 키가 필요합니다.']);
    exit;
}
$openrouterApiKey = $data['_openrouter_key'];

// 입력 데이터 검증
if (!isset($data['scenes']) || !is_array($data['scenes'])) {
    echo json_encode([
        'error' => '장면 데이터(scenes)가 필요합니다. 배열 형태로 전달해주세요.',
        'example' => [
            'scenes' => [
                '오늘 회사에서 진짜 미친 일을 겪었다.',
                '나는 평범한 회사원인데, 오늘 아침 출근하니까 내 자리에 있던 컴퓨터가 다른 걸로 바뀌어 있더라.',
                '팀장님이 부르시더니 전 직원 퇴사해서 그 컴퓨터 쓰라고 하시는 거임.'
            ]
        ]
    ]);
    exit;
}

// 장면 데이터
$scenes = $data['scenes'];

// 장면들을 하나의 텍스트로 결합
$scenesText = '';
foreach ($scenes as $index => $scene) {
    $scenesText .= "장면" . ($index + 1) . ": " . $scene . "\n";
}

// GPT-4o-mini를 위한 프롬프트 생성
$systemPrompt = '#지시문

각 장면(string[]) 앞에 장소 정보를 붙여서 제공하세요.
다른 설명이나 대답, 부연은 하지마세요.

# 출력형식
(국밥집) string[]
(편의점 앞) string[]
(사무실) string[]
(거실) string[]
(교문) string[]
...

# 규칙
1. 각 장면의 내용을 분석하여 가장 적절한 장소를 추론하세요.
2. 장소는 간단하고 명확하게 표현하세요.
3. 원본 텍스트는 그대로 유지하고 앞에 (장소)만 추가하세요.
4. 모든 장면에 대해 빠짐없이 장소를 추가하세요.';

// OpenRouter API 호출
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "https://openrouter.ai/api/v1/chat/completions",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => json_encode([
        'model' => 'openai/gpt-4o-mini',
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $scenesText]
        ],
        'temperature' => 0.7,
        'max_tokens' => 2000
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
    echo json_encode(['error' => 'API 호출 실패: ' . $err]);
    exit;
}

// API 응답 처리
$result = json_decode($response, true);

if (!$result || isset($result['error'])) {
    echo json_encode([
        'error' => $result['error']['message'] ?? 'Invalid JSON response',
        'raw_response' => $response
    ]);
    exit;
}

// GPT 응답 추출
$gpt_content = $result['choices'][0]['message']['content'] ?? '';

if (empty($gpt_content)) {
    echo json_encode([
        'error' => 'Empty response from API',
        'raw_response' => $response
    ]);
    exit;
}

// 응답을 파싱하여 장소가 추가된 장면 배열로 변환
$lines = explode("\n", trim($gpt_content));
$processedScenes = [];

foreach ($lines as $line) {
    $line = trim($line);
    if (!empty($line)) {
        // (장소) 부분과 내용 분리
        if (preg_match('/^\(([^)]+)\)\s*(.+)$/', $line, $matches)) {
            $processedScenes[] = [
                'location' => $matches[1],
                'scene' => $matches[2],
                'full_text' => $line
            ];
        } else {
            // 장소 정보가 없는 경우 원본 텍스트만 저장
            $processedScenes[] = [
                'location' => null,
                'scene' => $line,
                'full_text' => $line
            ];
        }
    }
}

// 응답 데이터 구성
$responseData = [
    'success' => true,
    'original_scenes' => $scenes,
    'processed_scenes' => $processedScenes,
    'raw_output' => $gpt_content,
    'token_info' => [
        'input_tokens' => $result['usage']['prompt_tokens'] ?? 0,
        'output_tokens' => $result['usage']['completion_tokens'] ?? 0,
        'total_tokens' => $result['usage']['total_tokens'] ?? 0
    ],
    'model_used' => 'gpt-4o-mini'
];

// JSON 응답 반환
header('Content-Type: application/json');
echo json_encode($responseData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>
