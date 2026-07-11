const crypto = require('crypto');
function verifyPassword(password, hash) {
  const [salt, key] = hash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return key === derivedKey.toString('hex');
}
const hash = '82e6fc6dd8215da60830f99021ba18b5:173219cc7d3aede428d0f73f04957908daaaefd6858f76ed7310f109f2e32084820f0053713ea4ad0335b7c2092ada3a9fe89b90f7d5f984c34b1a7378051db2';
console.log("Is 'eduexpress2026' correct?", verifyPassword('eduexpress2026', hash));
