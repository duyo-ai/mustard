<?php
/**
 * Duyo Story Generator API
 * 외부에서 스토리 생성을 호출할 수 있는 API 엔드포인트
 */

// 설정 파일 로드
require_once __DIR__ . '/config.php';

// 시간대 설정
date_default_timezone_set('Asia/Seoul');

// 최대 실행 시간 설정
set_time_limit(1800);

// CORS 헤더 설정
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-OpenRouter-Key');
header('Content-Type: application/json');

// OPTIONS 요청 처리 (CORS preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// POST 요청만 허용
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method Not Allowed',
        'message' => 'Only POST requests are allowed'
    ]);
    exit;
}

// API 키 검증
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';

if ($apiKey !== DUYO_API_KEY) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Unauthorized',
        'message' => 'Invalid API key'
    ]);
    exit;
}

// OpenRouter API 키 확인
$openrouterKey = $_SERVER['HTTP_X_OPENROUTER_KEY'] ?? '';
if (empty($openrouterKey)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => 'OpenRouter API key is required in X-OpenRouter-Key header'
    ]);
    exit;
}

// 요청 데이터 파싱
$requestData = json_decode(file_get_contents('php://input'), true);

if (!$requestData) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => 'Invalid JSON in request body'
    ]);
    exit;
}

// 필수 파라미터 검증
$personaType = $requestData['personaType'] ?? '일반인 썰';

// personaType에 따라 PHP 파일 결정
$phpFile = '';
switch ($personaType) {
    case '정보글':
        $phpFile = 'generate_story_info.php';
        break;
    case '간접광고':
        $phpFile = 'generate_story_ad.php';
        // 간접광고의 경우 adProduct 필수
        if (empty($requestData['adProduct'])) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Bad Request',
                'message' => 'adProduct is required for 간접광고 persona type'
            ]);
            exit;
        }
        break;
    case '일반인 썰':
    default:
        $phpFile = 'generate_story_general.php';
        break;
}

// PHP 파일 존재 확인
if (!file_exists(__DIR__ . '/' . $phpFile)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => 'Story generator file not found'
    ]);
    exit;
}

// OpenRouter API 키를 요청 데이터에 추가하여 내부 파일에 전달
$requestData['_openrouter_key'] = $openrouterKey;

// 전역 변수를 통해 데이터 전달 (php://input 대신 사용)
$GLOBALS['_API_REQUEST_DATA'] = $requestData;

// 출력 버퍼링 시작
ob_start();

// 파일 직접 include (전역 변수 방식으로 빠르게 처리)
try {
    include __DIR__ . '/' . $phpFile;
    $response = ob_get_clean();
    echo $response;
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => 'Failed to generate story',
        'details' => $e->getMessage()
    ]);
}
?>

