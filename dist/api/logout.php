<?php
declare(strict_types=1);
require __DIR__ . '/_lib.php';

lip_start_session();
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', !empty($_SERVER['HTTPS']), true);
}
session_destroy();

lip_json_response(['ok' => true]);
