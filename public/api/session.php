<?php
declare(strict_types=1);
require __DIR__ . '/_lib.php';

lip_json_response(['authenticated' => lip_is_authenticated()]);
