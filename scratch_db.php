<?php
header('Content-Type: text/plain');

echo "=== FINDING ALL .db FILES ===\n";
try {
    $dir = new RecursiveDirectoryIterator('/home/u898266115');
    $iterator = new RecursiveIteratorIterator($dir);
    foreach ($iterator as $file) {
        // Exclude proc, dev, sys, and cache dirs if they sneak in
        if (strpos($file->getPathname(), '/node_modules/') !== false) continue;
        if (strpos($file->getPathname(), '/.npm/') !== false) continue;
        
        if ($file->isFile() && (strpos($file->getFilename(), '.db') !== false || $file->getFilename() === 'crm.db')) {
            echo $file->getPathname() . " (Size: " . $file->getSize() . " bytes)\n";
            
            // Try to query tables in this db
            try {
                $db = new SQLite3($file->getPathname(), SQLITE3_OPEN_READONLY);
                $tables = [];
                $res = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
                while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
                    $tables[] = $row['name'];
                }
                echo "  Tables: " . implode(', ', $tables) . "\n";
                
                // If it has tables, show rows count of important tables
                if (in_array('channels', $tables)) {
                    $cCount = $db->querySingle("SELECT COUNT(*) FROM channels");
                    $mCount = $db->querySingle("SELECT COUNT(*) FROM messages");
                    echo "  Record count -> channels: $cCount, messages: $mCount\n";
                }
                $db->close();
            } catch (Exception $ex) {
                echo "  Error reading: " . $ex->getMessage() . "\n";
            }
        }
    }
} catch (Exception $e) {
    echo "Scan Error: " . $e->getMessage() . "\n";
}
?>
