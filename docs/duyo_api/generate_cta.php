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
$ctaType = $data['ctaType'] ?? '자동';

// 시스템 프롬프트 구성
$systemPrompt = '너는 전문적인 콘텐츠 CTA(Call To Action) 작성 전문가입니다. 사용자가 작성한 BODY 이야기를 바탕으로 시청자의 행동을 유도하는 효과적인 CTA를 작성하는 것이 목표입니다.
BODY의 핵심 내용을 파악하여 자연스럽고 설득력 있는 행동 유도 메시지를 만들어야 합니다. 시청자가 즉각적으로 행동하고 싶게 만드는 것이 목표입니다.

- CTA는 본문(BODY) 마지막에 포함되어 콘텐츠를 마무리합니다.
- CTA는 한문장으로 간결하고 명확하게 작성하세요.
- 마크다운을 사용하지 마세요.
- BODY의 말투와 분위기를 반영하여 작성하세요.

# 본문(BODY)
' . (!empty($bodyContent) ? $bodyContent : '(BODY 내용이 제공되지 않았습니다)') . '

# CTA 예시

## 참여 유도형
- "이 영상이 유익했다면 좋아요 눌러주세요."
- "당신의 생각을 댓글로 남겨주세요."
- "비슷한 경험 있으신가요? 댓글로 공유해주세요."
- "다음에 보고 싶은 주제를 댓글로 알려주세요."

## 구독/팔로우 유형
- "더 많은 이야기를 보고 싶다면 지금 구독해주세요."
- "새로운 영상이 올라오면 놓치지 않도록 팔로우하세요."
- "이런 꿀팁을 계속 받아보고 싶다면 알림 설정 잊지 마세요."

## 확장 시청 유도형
- "다음 영상에서 더 충격적인 이야기가 이어집니다."
- "이후 편을 보고 싶다면 구독 버튼을 눌러주세요."
- "관련 영상은 고정 댓글/설명란에서 확인하세요."
- "다음 이야기가 궁금하다면 오른쪽 영상을 눌러보세요."

## 행동 전환형 (외부 유도)
- "더 많은 정보를 원하시면 프로필 링크를 확인하세요."
- "무료 체험은 설명란 링크에서 신청 가능합니다."
- "자세한 자료는 웹사이트에서 확인할 수 있습니다."
- "할인 코드가 필요하다면 고정 댓글을 클릭하세요."

## 즉각 행동 촉구형 (FOMO/긴급성)
- "지금 바로 신청하지 않으면 늦을 수도 있습니다."
- "오늘까지만 무료로 제공됩니다. 설명란 링크 확인하세요."
- "이 기회는 곧 사라집니다. 지금 바로 참여하세요."
';

// OpenRouter API 설정
$apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
$apiKey = $openrouterApiKey;

// 메시지 구성
$userMessage = ($ctaType === '자동') 
    ? '위 BODY 이야기를 바탕으로 가장 적합한 마무리 CTA를 작성해주세요.'
    : '위 BODY 이야기를 바탕으로 ' . $ctaType . ' CTA를 작성해주세요.';

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
    
    // 각 CTA 타입별로 파싱
    $ctas = [];
    $pattern = '/== (.*?) ==\s*\n(.*?)(?=\n\n==|$)/s';
    
    if (preg_match_all($pattern, $aiResponse, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $ctaTypeName = trim($match[1]);
            $ctaContent = trim($match[2]);
            $ctas[$ctaTypeName] = $ctaContent;
        }
    }
    
    // 응답 반환
    echo json_encode([
        'success' => true,
        'ctas' => $ctas,
        'raw_response' => $aiResponse,
        'model_used' => $model,
        'token_info' => [
            'input_tokens' => $result['usage']['input_tokens'] ?? ($result['usage']['prompt_tokens'] ?? 0),
            'output_tokens' => $result['usage']['output_tokens'] ?? ($result['usage']['completion_tokens'] ?? 0)
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
?>


