<?php
// Endpoint para crear / actualizar / borrar rutas.
// Requiere sesión iniciada vía login.php.

declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') lip_json_error('Método no permitido', 405);

lip_require_auth();

$body   = lip_read_json_body();
$action = isset($body['action']) && is_string($body['action']) ? $body['action'] : '';

$routes = lip_load_routes();

if ($action === 'upsert') {
    $routeIn = isset($body['route']) && is_array($body['route']) ? $body['route'] : null;
    if (!$routeIn) lip_json_error('Falta el objeto route', 400);

    $clean = lip_sanitize_route($routeIn);

    $incomingId = isset($routeIn['id']) && is_string($routeIn['id']) ? $routeIn['id'] : '';
    $targetIndex = -1;
    if ($incomingId !== '') {
        foreach ($routes as $i => $r) {
            if (isset($r['id']) && $r['id'] === $incomingId) { $targetIndex = $i; break; }
        }
    }

    // Evitar códigos duplicados en otra ruta distinta.
    foreach ($routes as $i => $r) {
        if ($i === $targetIndex) continue;
        if (isset($r['code']) && strtoupper((string)$r['code']) === $clean['code']) {
            lip_json_error('Ya existe una ruta con ese código', 409);
        }
    }

    if ($targetIndex >= 0) {
        $clean['id'] = $incomingId;
        $routes[$targetIndex] = $clean;
    } else {
        $clean['id'] = lip_uuid_v4();
        $routes[] = $clean;
    }

    lip_save_routes($routes);
    lip_json_response(['id' => $clean['id']]);
}

if ($action === 'delete') {
    $id = isset($body['id']) && is_string($body['id']) ? trim($body['id']) : '';
    if ($id === '') lip_json_error('Falta el id', 400);

    $kept = array_values(array_filter($routes, fn($r) => !isset($r['id']) || $r['id'] !== $id));
    if (count($kept) === count($routes)) lip_json_error('Ruta no encontrada', 404);

    lip_save_routes($kept);
    lip_json_response(['ok' => true]);
}

lip_json_error('Acción desconocida', 400);
