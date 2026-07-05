<?php
header('Content-Type: text/plain');

echo "=== FINDING ALL LOG FILES ===\n";
try {
    $dir = new RecursiveDirectoryIterator('/home/u898266115');
    $iterator = new RecursiveIteratorIterator($dir);
    foreach ($iterator as $file) {
        if ($file->isFile() && (strpos($file->getFilename(), '.log') !== false || strpos($file->getFilename(), '.err') !== false || strpos($file->getFilename(), '.out') !== false)) {
            // Exclude common large/unrelated logs if any
            if (strpos($file->getPathname(), '/node_modules/') !== false) continue;
            if (strpos($file->getPathname(), '/.npm/') !== false) continue;
            
            echo $file->getPathname() . " (Size: " . $file->getSize() . " bytes)\n";
            
            // Read last 20 lines of the log
            $lines = file($file->getPathname());
            if ($lines !== false) {
                $lastLines = array_slice($lines, -20);
                echo "--- LAST LINES ---\n";
                echo implode("", $lastLines);
                echo "------------------\n\n";
            }
        }
    }
} catch (Exception $e) {
    echo "Scan Error: " . $e->getMessage() . "\n";
}
?>
