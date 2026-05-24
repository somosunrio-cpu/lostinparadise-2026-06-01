<?php
// ============================================================================
//  CONFIGURACIÓN DEL ADMIN
// ----------------------------------------------------------------------------
//  Edita el USUARIO y el HASH DE CONTRASEÑA antes de subir a producción.
//
//  Para generar un nuevo hash, abre cualquier terminal con PHP y ejecuta:
//      php -r "echo password_hash('TU_NUEVA_CONTRASEÑA', PASSWORD_BCRYPT), PHP_EOL;"
//
//  Pega el resultado en ADMIN_PASSWORD_HASH (entre comillas simples).
//
//  Contraseña por defecto: "changeme"  ← CAMBIAR ANTES DE PRODUCCIÓN.
// ============================================================================

return [
    'admin_username'      => 'admin',
    // Hash bcrypt de "changeme" — genera el tuyo y reemplázalo.
    'admin_password_hash' => '$2y$12$jem.IlMPguwT1X1nanbR7u5daeZMQuixL9LCUL2tbrzY.hqVid2aO',

    // Nombre de la cookie de sesión (puedes dejarlo así).
    'session_name'        => 'lip_admin',

    // Duración de la sesión en segundos (por defecto 8 horas).
    'session_lifetime'    => 8 * 60 * 60,
];
