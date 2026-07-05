<?php
header('Content-Type: application/json');
try {
    $db = new SQLite3('/home/u898266115/crm.db');
    
    // Query channels
    $channels = [];
    $res = $db->query("SELECT id, type, name, page_id, active, status FROM channels");
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $channels[] = $row;
    }
    
    // Query conversations
    $conversations = [];
    $res = $db->query("SELECT id, contact_id, channel_id, channel_type, last_message_at, last_message FROM conversations ORDER BY id DESC LIMIT 15");
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $conversations[] = $row;
    }
    
    // Query messages
    $messages = [];
    $res = $db->query("SELECT id, conversation_id, direction, content, created_at FROM messages ORDER BY id DESC LIMIT 20");
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
        $messages[] = $row;
    }
    
    echo json_encode([
        'channels' => $channels,
        'conversations' => $conversations,
        'messages' => $messages
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
