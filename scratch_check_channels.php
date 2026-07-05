<?php
header('Content-Type: text/plain');

try {
    $db = new SQLite3('/home/u898266115/crm-data/crm.db', SQLITE3_OPEN_READONLY);
    
    echo "=== CHANNELS IN DATABASE ===\n";
    $res = $db->query("SELECT id, name, type, page_id, phone_number_id, 
                              substr(access_token, 1, 15) as token_start,
                              length(access_token) as token_len
                       FROM channels");
    if ($res) {
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            echo "ID: {$row['id']}, Name: {$row['name']}, Type: {$row['type']}, PageID: {$row['page_id']}, PhoneID: {$row['phone_number_id']}, Token: {$row['token_start']}... (len: {$row['token_len']})\n";
        }
    } else {
        echo "No channels found.\n";
    }
    
    $db->close();
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
