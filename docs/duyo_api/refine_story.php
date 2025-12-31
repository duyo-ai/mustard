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
$model = trim($data['model'] ?? 'claude-4.5');
$userMessage = $data['message'] ?? '';
$hookContent = $data['hookContent'] ?? '';
$bodyContent = $data['bodyContent'] ?? '';
$ctaContent = $data['ctaContent'] ?? '';
$conversationHistory = $data['conversationHistory'] ?? [];

// 시스템 프롬프트 구성
$systemPrompt = '너는 전문적인 이야기 편집 어시스턴트입니다. 사용자의 이야기를 더 흥미롭고 완성도 높게 다듬는 것이 목표입니다.
사용자의 요청에 따라 HOOK, BODY, CTA 각 섹션을 개선하거나 수정합니다.

수정 사항이 있는 부분만 == HOOK, BODY, CTA == 로 구분하여 제시합니다. 수정 사항이 없는 경우 response만 반환합니다.
단순 질문이나 조언을 요청할 경우, 수정 없이 자연스럽게 대화하세요.

# 현재 작업 중인 이야기 구조

== HOOK ==
' . (!empty($hookContent) ? $hookContent : '(아직 작성되지 않음)') . '

== BODY ==
' . (!empty($bodyContent) ? $bodyContent : '(아직 작성되지 않음)') . '

== CTA ==
' . (!empty($ctaContent) ? $ctaContent : '(아직 작성되지 않음)') . '


# 출력 형식

== HOOK ==
[수정된 부분이 있을 경우, 수정된 HOOK 텍스트]

== BODY ==
[수정된 부분이 있을 경우, 수정된 BODY 텍스트]

== CTA ==
[수정된 부분이 있을 경우, 수정된 CTA 텍스트]

response: [사용자에게 반환할 짧은 메시지]';

// 모델별 API 설정
$apiUrl = '';
$apiKey = '';
$requestBody = [];

// OpenRouter API 설정 (모든 모델 통합)
$apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
$apiKey = $openrouterApiKey;

// 모델명 매핑
if (strpos($model, 'claude') === 0) {
    $apiModel = 'openai/gpt-4o';  // Claude는 GPT-4o로 대체
} elseif (strpos($model, 'gpt') === 0) {
    $apiModel = 'openai/gpt-4o';  // GPT 모델
} else {
    $apiModel = 'openai/gpt-4o';  // 기본값
}

// 메시지 히스토리 구성
$messages = [
    ['role' => 'system', 'content' => $systemPrompt]
];

foreach ($conversationHistory as $msg) {
    $messages[] = [
        'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
        'content' => $msg['content']
    ];
}

// 현재 사용자 메시지 추가
$messages[] = [
    'role' => 'user',
    'content' => $userMessage
];

$requestBody = [
    'model' => $apiModel,
    'max_tokens' => 4096,
    'temperature' => 0.7,
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
        'debug_model' => $model,
        'debug_api_model' => $apiModel ?? 'N/A'
    ]);
} else {
    $result = json_decode($response, true);
    
    if (!$result || isset($result['error'])) {
        echo json_encode([
            'error' => $result['error']['message'] ?? 'Invalid response from API',
            'raw_response' => $response,
            'debug_model_requested' => $model,
            'debug_api_model_sent' => $apiModel ?? 'N/A',
            'debug_request_body' => json_encode($requestBody ?? [])
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
    
    // 응답 반환
    echo json_encode([
        'success' => true,
        'response' => $aiResponse,
        'model_used' => $model
    ]);
}
?>

