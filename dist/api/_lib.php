<?php
// Shared helpers for all PHP endpoints.

declare(strict_types=1);

function lip_config(): array {
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
    }
    return $cfg;
}

function lip_json_response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lip_json_error(string $message, int $status = 400): void {
    lip_json_response(['error' => $message], $status);
}

function lip_read_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $body = json_decode($raw, true);
    if (!is_array($body)) lip_json_error('Cuerpo JSON inválido', 400);
    return $body;
}

function lip_start_session(): void {
    $cfg = lip_config();
    if (session_status() === PHP_SESSION_ACTIVE) return;

    session_name($cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => 0, // session cookie
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    @ini_set('session.gc_maxlifetime', (string)$cfg['session_lifetime']);
    session_start();

    // Manual idle timeout
    if (!empty($_SESSION['lip_auth_at'])) {
        $elapsed = time() - (int)$_SESSION['lip_auth_at'];
        if ($elapsed > $cfg['session_lifetime']) {
            $_SESSION = [];
            session_destroy();
        }
    }
}

function lip_is_authenticated(): bool {
    lip_start_session();
    return !empty($_SESSION['lip_auth']) && $_SESSION['lip_auth'] === true;
}

function lip_require_auth(): void {
    if (!lip_is_authenticated()) lip_json_error('No autorizado', 401);
}

function lip_data_file(): string {
    return __DIR__ . '/data/routes.json';
}

function lip_load_routes(): array {
    $path = lip_data_file();
    if (!is_file($path)) return [];
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function lip_save_routes(array $routes): void {
    $path = lip_data_file();
    $dir  = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    // Atomic write + simple file lock to avoid corruption on concurrent writes.
    $tmp = $path . '.tmp';
    $fp  = fopen($tmp, 'wb');
    if (!$fp) lip_json_error('No se pudo escribir el archivo', 500);
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        lip_json_error('No se pudo bloquear el archivo', 500);
    }
    fwrite($fp, json_encode($routes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!rename($tmp, $path)) {
        @unlink($tmp);
        lip_json_error('No se pudo guardar el archivo', 500);
    }
    @chmod($path, 0664);
}

function lip_uuid_v4(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function lip_str(array $arr, string $key, int $max, string $default = ''): string {
    $v = $arr[$key] ?? $default;
    if (!is_string($v)) return $default;
    $v = trim($v);
    if (mb_strlen($v) > $max) $v = mb_substr($v, 0, $max);
    return $v;
}

function lip_sanitize_route(array $input): array {
    $allowedDifficulty = ['Fácil', 'Media', 'Difícil'];
    $difficulty = $input['difficulty'] ?? 'Fácil';
    if (!in_array($difficulty, $allowedDifficulty, true)) $difficulty = 'Fácil';

    $code = strtoupper(lip_str($input, 'code', 64));
    if ($code === '') lip_json_error('El código es obligatorio', 422);
    if (!preg_match('/^[A-Z0-9_-]{1,64}$/', $code)) lip_json_error('Código con caracteres no válidos', 422);

    $name = lip_str($input, 'name', 255);
    if ($name === '') lip_json_error('El nombre es obligatorio', 422);

    $pointsRaw = $input['points'] ?? [];
    if (!is_array($pointsRaw)) $pointsRaw = [];
    if (count($pointsRaw) > 500) lip_json_error('Demasiados puntos (máx. 500)', 422);

    $points = [];
    foreach ($pointsRaw as $p) {
        if (!is_array($p)) continue;
        $lat = isset($p['lat']) ? (float)$p['lat'] : null;
        $lng = isset($p['lng']) ? (float)$p['lng'] : null;
        if ($lat === null || $lng === null) continue;
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) continue;
        $ins = isset($p['instruction']) && is_string($p['instruction']) ? mb_substr(trim($p['instruction']), 0, 500) : '';
        $points[] = ['lat' => $lat, 'lng' => $lng, 'instruction' => $ins];
    }

    return [
        'id'          => '', // assigned later
        'code'        => $code,
        'name'        => $name,
        'description' => lip_str($input, 'description', 2000),
        'distance'    => lip_str($input, 'distance', 64),
        'duration'    => lip_str($input, 'duration', 64),
        'difficulty'  => $difficulty,
        'points'      => $points,
    ];
}
