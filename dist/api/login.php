<?php
declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') lip_json_error('Método no permitido', 405);

$cfg  = lip_config();
$body = lip_read_json_body();

$user = isset($body['username']) && is_string($body['username']) ? trim($body['username']) : '';
$pass = isset($body['password']) && is_string($body['password']) ? $body['password'] : '';

if ($user === '' || $pass === '') lip_json_error('Usuario y contraseña requeridos', 400);

// Pequeño retardo constante para mitigar ataques de fuerza bruta.
usleep(300000);

$expectedUser = (string)$cfg['admin_username'];
$expectedHash = (string)$cfg['admin_password_hash'];

$userOk = hash_equals($expectedUser, $user);
$passOk = password_verify($pass, $expectedHash);

if (!$userOk || !$passOk) lip_json_error('Credenciales incorrectas', 401);

lip_start_session();
session_regenerate_id(true);
$_SESSION['lip_auth']    = true;
$_SESSION['lip_auth_at'] = time();
$_SESSION['lip_user']    = $expectedUser;

lip_json_response(['ok' => true]);
