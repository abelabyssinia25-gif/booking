const bcrypt = require('bcryptjs');

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10);

async function hashPassword(plain) {
const salt = await bcrypt.genSalt(SALT_ROUNDS);
return bcrypt.hash(plain, salt);
}
async function comparePassword(plain, hash) {
return bcrypt.compare(plain, hash);
}
module.exports = { hashPassword, comparePassword };