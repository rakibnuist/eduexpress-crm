<?php
header('Content-Type: text/plain');

echo "=== FINDING ALL .db FILES ===\n";
try {
    $dir = new RecursiveDirectoryIterator('/home/u898266115');
    $iterator = new RecursiveIteratorIterator($dir);
    foreach ($iterator as $file) {
        if ($file->isDir()) continue;
        
        // Exclude node_modules and cache
        if (strpos($file->getPathname(), '/node_modules/') !== false) continue;
        if (strpos($file->getPathname(), '/.npm/') !== false) continue;
        
        if (strpos($file->getFilename(), '.db') !== false || $file->getFilename() === 'crm.db') {
            echo "Found: " . $file->getPathname() . " (Size: " . $file->getSize() . " bytes)\n";
            
            // Try to query tables in this db
            try {
                $db = @new SQLite3($file->getPathname(), SQLITE3_OPEN_READONLY);
                if (!$db) {
                    echo "  Could not open database\n";
                    continue;
                }
                $res = @$db->query("SELECT name FROM sqlite_master WHERE type='table'");
                if ($res === false) {
                    echo "  Could not query sqlite_master (not a valid database?)\n";
                    $db->close();
                    continue;
                }
                $tables = [];
                while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
                    $tables[] = $row['name'];
                }
                echo "  Tables: " . implode(', ', $tables) . "\n";
                
                // If it has tables, show rows count of important tables
                if (in_array('channels', $tables)) {
                    $cCount = @$db->querySingle("SELECT COUNT(*) FROM channels");
                    $mCount = @$db->querySingle("SELECT COUNT(*) FROM messages");
                    echo "  Record count -> channels: $cCount, messages: $mCount\n";
                }
                $db->close();
            } catch (Exception $ex) {
                echo "  Error reading: " . $ex->getMessage() . "\n";
            }
            echo "\n";
        }
    }
} catch (Exception $e) {
    echo "Scan Error: " . $e->getMessage() . "\n";
}
?>
