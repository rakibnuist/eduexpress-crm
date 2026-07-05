<?php
header('Content-Type: text/plain');

function printTail($title, $filePath, $linesCount = 100) {
    echo "=== $title ($filePath) ===\n";
    if (file_exists($filePath)) {
        $lines = file($filePath);
        if ($lines !== false) {
            $lastLines = array_slice($lines, -$linesCount);
            echo implode("", $lastLines);
        } else {
            echo "Could not read file lines\n";
        }
    } else {
        echo "File does not exist\n";
    }
    echo "\n";
}

printTail("STDERR", '/home/u898266115/domains/crm.eduexpressint.com/nodejs/stderr.log');
printTail("CONSOLE LOG", '/home/u898266115/domains/crm.eduexpressint.com/nodejs/console.log');
?>
