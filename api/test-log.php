<?php
    header('Content-Type: application/json');

    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(E_ALL);
    ini_set('log_errors', 1);
    ini_set('error_log', '/home/tapservi/public_html/api/logs/custom_errors.log');

    $logPath = '/home/tapservi/public_html/api/logs/custom_errors.log';
    $results = [];

    // Test file logging
    error_log("Test log entry for $logPath at " . date('Y-m-d H:i:s'));
    $isFileWritable = is_writable($logPath);
    $fileExists = file_exists($logPath);
    $dirWritable = is_writable(dirname($logPath));
    $results[] = [
        'path' => $logPath,
        'exists' => $fileExists ? 'yes' : 'no',
        'file_writable' => $isFileWritable ? 'yes' : 'no',
        'directory_writable' => $dirWritable ? 'yes' : 'no',
        'status' => $fileExists && $isFileWritable ? "Successfully logged to $logPath" : "Failed to log to $logPath"
    ];

    // Test with a custom error
    trigger_error("Custom test error for logging at " . date('Y-m-d H:i:s'), E_USER_ERROR);

    // Check PHP configuration
    $phpConfig = [
        'log_errors' => ini_get('log_errors'),
        'error_log' => ini_get('error_log'),
        'error_reporting' => ini_get('error_reporting'),
        'user' => get_current_user(),
        'effective_user' => function_exists('posix_geteuid') ? posix_geteuid() : 'N/A',
        'group' => function_exists('posix_getegid') ? posix_getegid() : 'N/A'
    ];

    // Attempt to write directly to file
    $directWrite = @file_put_contents($logPath, "Direct write test at " . date('Y-m-d H:i:s') . "\n", FILE_APPEND);
    $results[] = [
        'path' => $logPath,
        'direct_write' => $directWrite !== false ? 'Success' : 'Failed',
        'error' => $directWrite === false ? error_get_last()['message'] ?? 'Unknown error' : 'N/A'
    ];

    echo json_encode([
        'message' => 'Logging test completed',
        'results' => $results,
        'phpConfig' => $phpConfig
    ]);
    ?>