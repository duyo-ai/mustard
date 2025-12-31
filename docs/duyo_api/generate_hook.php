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

// 입력 데이터 가져오기
$model = 'claude-sonnet-4-5-20250929'; // 고정 모델
$bodyContent = $data['bodyContent'] ?? '';
$hookType = $data['hookType'] ?? '자동';

// 시스템 프롬프트 구성
$systemPrompt = '너는 전문적인 콘텐츠 HOOK 작성 전문가입니다. 
사용자가 작성한 BODY 이야기를 바탕으로 시청자의 흥미를 끄는 강력한 HOOK을 작성하는 것이 목표입니다.
BODY의 핵심 내용을 파악하여 강력한 첫인상을 만들어야 합니다.

- HOOK은 한문장으로 간결하고 강렬하게 작성하세요.
- 마크다운을 사용하지 마세요.
- BODY의 말투를 반영하여 작성하세요.

# 본문 이야기 (BODY)
' . (!empty($bodyContent) ? $bodyContent : '(BODY 내용이 제공되지 않았습니다)') . '

# HOOK 예시
- 질문형: 시청자에게 질문을 던져 호기심을 유발 - "혹시 ○○ 알고 계셨나요?"
- 충격 사실형: 반전이나 충격적인 사실을 암시 - "사실, 대부분은 ○○를 완전히 잘못 알고 있습니다."
- 대비형: 두 가지를 대비시켜 긴장감 조성 - "○○와 ○○, 어떤 게 더 위험할까요?"
- 스토리 티저형: 이야기의 흐름을 티저처럼 암시 - "○○한 남자가 결국 ○○하게 됩니다."
- 통계 강조형: 극단적인 통계, 수치를 활용해 흥미 부여 - "10명 중 8명이 ○○ 때문에 실패합니다."
- 행동 유도형: 시청자에게 행동을 유도 - "끝까지 보시면 ○○를 알 수 있습니다."
';

// OpenRouter API 설정
$apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
$apiKey = $openrouterApiKey;

// 메시지 구성
$userMessage = ($hookType === '자동') 
    ? '위 BODY 이야기를 바탕으로 가장 적합한 HOOK을 작성해주세요.'
    : '위 BODY 이야기를 바탕으로 ' . $hookType . ' HOOK을 작성해주세요.';

$messages = [
    [
        'role' => 'system',
        'content' => $systemPrompt
    ],
    [
        'role' => 'user',
        'content' => $userMessage
    ]
];

$requestBody = [
    'model' => 'anthropic/claude-sonnet-4-5-20250929',
    'max_tokens' => 2048,
    'temperature' => 0.8,
    'messages' => $messages
];

$headers = [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $openrouterApiKey
];

// cURL 요청
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => $apiUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => json_encode($requestBody),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
]);

$response = curl_exec($curl);
$err = curl_error($curl);

curl_close($curl);

if ($err) {
    echo json_encode([
        'error' => $err,
        'debug_model' => $model
    ]);
} else {
    $result = json_decode($response, true);
    
    if (!$result || isset($result['error'])) {
        echo json_encode([
            'error' => $result['error']['message'] ?? 'Invalid response from API',
            'raw_response' => $response
        ]);
        exit;
    }
    
    // 응답 텍스트 추출
    $aiResponse = $result['choices'][0]['message']['content'] ?? '';
    
    if (empty($aiResponse)) {
        echo json_encode([
            'error' => 'Empty response from API',
            'raw_response' => $response
        ]);
        exit;
    }
    
    // 각 HOOK 타입별로 파싱
    $hooks = [];
    $pattern = '/== (.*?) ==\s*\n(.*?)(?=\n\n==|$)/s';
    
    if (preg_match_all($pattern, $aiResponse, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $hookTypeName = trim($match[1]);
            $hookContent = trim($match[2]);
            $hooks[$hookTypeName] = $hookContent;
        }
    }
    
    // 응답 반환
    echo json_encode([
        'success' => true,
        'hooks' => $hooks,
        'raw_response' => $aiResponse,
        'model_used' => $model,
        'token_info' => [
            'input_tokens' => $result['usage']['input_tokens'] ?? ($result['usage']['prompt_tokens'] ?? 0),
            'output_tokens' => $result['usage']['output_tokens'] ?? ($result['usage']['completion_tokens'] ?? 0)
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
?>

