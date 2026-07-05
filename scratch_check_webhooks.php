<?php
header('Content-Type: text/plain');

try {
    $db = new SQLite3('/home/u898266115/crm-data/crm.db', SQLITE3_OPEN_READONLY);
    
    echo "=== RECENT INBOUND MESSAGES ===\n";
    $res = $db->query("SELECT m.id, m.conversation_id, m.content, m.direction, m.created_at, c.name as channel_name 
                       FROM messages m 
                       JOIN conversations conv ON m.conversation_id = conv.id
                       JOIN channels c ON conv.channel_id = c.id
                       ORDER BY m.id DESC LIMIT 10");
    if ($res) {
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            echo "[{$row['created_at']}] Channel: {$row['channel_name']}, Direction: {$row['direction']}, Content: {$row['content']}\n";
        }
    } else {
        echo "No recent messages found.\n";
    }
    echo "\n";

    echo "=== RECENT ACTIVITY LOGS ===\n";
    $res = $db->query("SELECT id, type, details, created_at FROM activity_log ORDER BY id DESC LIMIT 15");
    if ($res) {
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            echo "[{$row['created_at']}] Type: {$row['type']}, Details: {$row['details']}\n";
        }
    } else {
        echo "No recent activity logs found.\n";
    }
    
    $db->close();
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
