# Despliegue en IONOS (o cualquier hosting Apache + PHP)

Esta app es una **SPA estática** (Vite + React Router) con un pequeño **backend en PHP** para
guardar las rutas en un archivo JSON dentro del servidor.

---

## 1. Generar el build

En tu equipo (o desde GitHub Actions):

```bash
bun install      # o: npm install
bun run build    # o: npm run build
```

Esto produce la carpeta `dist/` con:

```
dist/
├── index.html
├── assets/...
├── .htaccess
└── api/
    ├── _lib.php
    ├── config.php          ← editar credenciales
    ├── login.php
    ├── logout.php
    ├── session.php
    ├── save.php
    ├── .htaccess
    └── data/
        ├── .htaccess
        └── routes.json     ← datos iniciales
```

---

## 2. Cambiar el usuario y la contraseña del admin

Antes de subir a producción, **abre `dist/api/config.php`** y reemplaza la línea:

```php
'admin_password_hash' => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
```

por el hash de **tu** contraseña. Para generarlo, en cualquier máquina con PHP:

```bash
php -r "echo password_hash('TU_CONTRASEÑA_AQUI', PASSWORD_BCRYPT), PHP_EOL;"
```

Copia el resultado entre comillas simples. Cambia también `admin_username` si quieres.

> ⚠️ La contraseña por defecto es `changeme` con usuario `admin`. **No la dejes así.**

---

## 3. Subir a IONOS

1. Entra al **FTP** o **File Manager** de IONOS.
2. Borra el contenido viejo de `public_html/` (o del subdominio donde quieras alojar la app).
3. Sube **el contenido de `dist/`** (no la carpeta `dist` en sí — sus archivos).
   La estructura final en el servidor debe quedar:

   ```
   public_html/
   ├── index.html
   ├── .htaccess
   ├── assets/
   └── api/
       ├── *.php
       └── data/routes.json
   ```

4. Asegúrate de que la carpeta `api/data/` tenga **permisos de escritura** para PHP
   (normalmente `755` en directorios y `664` en `routes.json`).
   Si tras intentar guardar una ruta ves el error "No se pudo escribir el archivo", entra
   por FTP y cambia los permisos de `api/data/` y `api/data/routes.json` a `0775` / `0664`.

5. Visita tu dominio en el navegador. La home debería cargar.
   - Introduce un código de ruta → ves el mapa.
   - Pulsa "Acceso administrador" abajo → introduce tu usuario/contraseña.
   - Edita y guarda → el cambio se persiste en `api/data/routes.json` y todos los visitantes lo ven al instante.

---

## 4. Cómo funciona

- **Lecturas públicas**: el navegador descarga `/api/data/routes.json` directamente.
  No hace falta PHP para leer.
- **Escrituras (admin)**:
  - `POST /api/login.php` → valida usuario/contraseña, crea cookie de sesión PHP.
  - `POST /api/save.php` → guarda o borra rutas. Comprueba la sesión antes de tocar nada.
  - El JSON se escribe de forma atómica con un fichero `.tmp` + `rename()` y un `flock()`
    para evitar corrupción si dos admins guardan a la vez.

---

## 5. Backups

`api/data/routes.json` es **todo** tu contenido. Para hacer copia de seguridad:

- Descárgalo por FTP cada cierto tiempo, o
- Configura un cron en IONOS que lo copie a otro directorio:
  ```bash
  cp /ruta/al/api/data/routes.json /ruta/backups/routes-$(date +%Y%m%d).json
  ```

---

## 6. Vista previa local

Para probarlo en local con PHP:

```bash
bun run build
cd dist
php -S localhost:8000     # requiere PHP instalado
```

Abre `http://localhost:8000`. El servidor embebido de PHP ejecutará los `.php`.

> Nota: el `dev` de Vite (`bun run dev`) **no ejecuta PHP**. En ese modo
> las lecturas funcionan (porque `routes.json` se sirve como archivo estático),
> pero el panel admin no podrá iniciar sesión ni guardar — eso solo funciona
> con el build subido a un servidor con PHP.
