<?php
header('Content-Type: text/plain');

$newToken = 'EAAVoF1AFCwoBR1ZAIqUN6mXMlFpaXhpzMgFlCP1KplZBNSY0FPagOD6iJBKeamBTvaCZAPo6YEw9YO1IZCT63BqzrtqBzZBSDGZCG4mtlPZAKQF4ZBmXGlowYXoSIzgZCB1j102Klcx4gMbOjeJwAUtroyJ9D95CnQ3C7j5tZA6OfItn22siqZAyzVXL1gI4KI7NoPstAZDZD';

try {
    $db = new SQLite3('/home/u898266115/crm-data/crm.db', SQLITE3_OPEN_READWRITE);
    
    // Update config table
    $stmt = $db->prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('page_access_token', :token)");
    $stmt->bindValue(':token', $newToken, SQLITE3_TEXT);
    $stmt->execute();
    echo "Updated config page_access_token.\n";
    
    // Update channels table
    $stmt = $db->prepare("UPDATE channels SET access_token = :token");
    $stmt->bindValue(':token', $newToken, SQLITE3_TEXT);
    $stmt->execute();
    echo "Updated all channels access_token.\n";
    
    $db->close();
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
