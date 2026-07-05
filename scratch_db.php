<?php
header('Content-Type: text/plain');

$logFile = '/home/u898266115/domains/crm.eduexpressint.com/nodejs/console.log';
echo "=== READING CRM CONSOLE.LOG ===\n";
if (file_exists($logFile)) {
    $lines = file($logFile);
    if ($lines !== false) {
        $lastLines = array_slice($lines, -150);
        echo implode("", $lastLines);
    } else {
        echo "Could not read console.log lines\n";
    }
} else {
    echo "console.log file does not exist\n";
}
?>
