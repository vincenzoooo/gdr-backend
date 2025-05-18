const pool = require('../database');
const bcrypt = require('bcrypt');

class User {
  static async findByUsername(username) {
    const result = await pool.query('SELECT * FROM users WHERE username = 
$1', [username]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = 
$1', [email]);
    return result.rows[0];
  }

  static async create(username, password, email) {
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds 
= 10
    const result = await pool.query(
      'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) 
RETURNING id, username, email',
      [username, hashedPassword, email]
    );
    return result.rows[0];
  }
}

module.exports = User;
