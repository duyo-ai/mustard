<?php
/**
 * 장면 나누기 API
 * Grok 4 Fast를 사용하여 이야기를 장면별로 분할합니다.
 */

// 파일 최상단에 시간대 설정 추가
date_default_timezone_set('Asia/Seoul');

// 최대 실행 시간을 180초(3분)으로 설정
set_time_limit(180);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'POST 요청만 허용됩니다.']);
    exit;
}

// API를 통해 호출되었는지 확인 (빠른 처리)
if (isset($GLOBALS['_API_REQUEST_DATA'])) {
    $input = $GLOBALS['_API_REQUEST_DATA'];
} else {
    $input = json_decode(file_get_contents('php://input'), true);
}

// OpenRouter API 키 필수 입력
if (empty($input['_openrouter_key'])) {
    echo json_encode(['success' => false, 'error' => 'OpenRouter API 키가 필요합니다.']);
    exit;
}
$openrouterApiKey = $input['_openrouter_key'];

if (!isset($input['story']) || empty($input['story'])) {
    echo json_encode(['success' => false, 'error' => '이야기 내용이 필요합니다.']);
    exit;
}

$story = $input['story'];
$model = 'x-ai/grok-4-fast'; // 모델 고정

// 장면 나누기 프롬프트
$systemPrompt = <<<PROMPT
당신은 이야기를 짧은 장면들로 나누는 전문가입니다.
주어진 이야기를 아래 규칙에 맞게 장면별로 분할해주세요.

# 가장 중요한 규칙 (절대 준수)
★★★ 원본 이야기의 글자를 단 한 글자도 변경하지 마세요! ★★★
- 원본 텍스트를 그대로 복사하여 사용합니다.
- 오직 줄바꿈과 "scene" 구분, 대사 규칙만 추가합니다.
- 장면 전환이 자연스럽게 나누어지도록 합니다.

# 출력 규칙
1. "scene"을 활용하여 화면전환을 표시하고 장면을 나눕니다.
2. 각 장면은 최대한 작은 단위로 내용을 나누어서 2~4줄 사이의 내용으로 작성합니다.
3. 한 줄은 20글자 내외로 짧게 작성합니다.
4. 긴 문장은 여러 줄로 나누어서 출력합니다.

# 대사 규칙
- **긴 대사를 여러줄로 나누는 경우, 쌍따옴표로 마무리하고 다음줄로 나타냅니다.**
- 대사를 나눌 때에는 항상 쌍따옴표로 감싸고 (인물)정보를 중복으로 추가합니다.
- 다른 인물의 대사가 등장하지 않을 경우, (인물)정보를 생략합니다.

## 대사 예시
(아가씨)"안녕하세요. 저는" 
(아가씨)"옆집사는 사람인데요."

# 출력 형식
각 장면은 다음 형식으로 출력합니다:

scene 1
(장면 내용 - 2~4줄)

scene 2
(장면 내용 - 2~4줄)

...
PROMPT;

$userMessage = "다음 이야기를 장면별로 나눠주세요:\n\n" . $story;

// OpenRouter API 호출
$curl = curl_init();

$messages = [
    ['role' => 'system', 'content' => $systemPrompt],
    ['role' => 'user', 'content' => $userMessage]
];

curl_setopt_array($curl, [
    CURLOPT_URL => "https://openrouter.ai/api/v1/chat/completions",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 180,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => json_encode([
        'model' => $model,
        'max_tokens' => 8192,
        'temperature' => 0.5,
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
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);

curl_close($curl);

if ($err) {
    echo json_encode([
        'success' => false,
        'error' => 'API 요청 실패: ' . $err
    ]);
    exit;
}

if ($httpCode !== 200) {
    $errorResponse = json_decode($response, true);
    echo json_encode([
        'success' => false,
        'error' => 'API 오류 (HTTP ' . $httpCode . ')',
        'details' => $errorResponse['error']['message'] ?? $response
    ]);
    exit;
}

$result = json_decode($response, true);

if (!isset($result['choices'][0]['message']['content'])) {
    echo json_encode([
        'success' => false,
        'error' => '응답 파싱 실패',
        'raw_response' => $result
    ]);
    exit;
}

$content = $result['choices'][0]['message']['content'];

/**
 * 대사 형식 변환 함수
 * (인물)"대사내용\n다음줄\n다음줄" 형식을
 * (인물)"대사내용"
 * (인물)"다음줄"
 * (인물)"다음줄" 형식으로 변환
 */
function formatDialogueLines($content) {
    $lines = explode("\n", $content);
    $result = [];
    $currentCharacter = null;
    $inDialogue = false;
    
    foreach ($lines as $line) {
        $trimmedLine = trim($line);
        
        // (인물)"대사" 형식 감지 - 시작 부분
        if (preg_match('/^\(([^)]+)\)"(.*)$/', $trimmedLine, $matches)) {
            $currentCharacter = $matches[1];
            $dialogueContent = $matches[2];
            
            // 대사가 같은 줄에서 끝나는 경우 ("로 끝남)
            if (substr($dialogueContent, -1) === '"') {
                $result[] = $trimmedLine;
                $currentCharacter = null;
                $inDialogue = false;
            } else {
                // 대사가 여러 줄에 걸쳐 있는 경우
                $inDialogue = true;
                $result[] = '(' . $currentCharacter . ')"' . $dialogueContent . '"';
            }
        }
        // 대사 중간/끝 줄 (인물 태그 없이 대사만 있는 경우)
        elseif ($inDialogue && $currentCharacter && $trimmedLine !== '') {
            // 대사가 끝나는 줄인지 확인 ("로 끝남)
            if (substr($trimmedLine, -1) === '"') {
                // 끝나는 따옴표 제거하고 새 형식으로
                $dialogueContent = substr($trimmedLine, 0, -1);
                $result[] = '(' . $currentCharacter . ')"' . $dialogueContent . '"';
                $currentCharacter = null;
                $inDialogue = false;
            } else {
                // 중간 줄
                $result[] = '(' . $currentCharacter . ')"' . $trimmedLine . '"';
            }
        }
        // 일반 줄 (대사가 아닌 경우)
        else {
            if ($trimmedLine === '' && $inDialogue) {
                // 빈 줄이면 대사 종료
                $inDialogue = false;
                $currentCharacter = null;
            }
            $result[] = $line;
        }
    }
    
    return implode("\n", $result);
}

// 대사 형식 변환 적용
$formattedContent = formatDialogueLines($content);

// 성공 응답
echo json_encode([
    'success' => true,
    'content' => $formattedContent,
    'usage' => $result['usage'] ?? null,
    'model' => $result['model'] ?? $model,
    'token_info' => [
        'input_tokens' => $result['usage']['prompt_tokens'] ?? 0,
        'output_tokens' => $result['usage']['completion_tokens'] ?? 0
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>

