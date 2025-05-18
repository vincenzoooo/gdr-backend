const request = require('supertest');
const app = require('../server'); // Assicurati che il percorso sia corretto
const pool = require('../database');
const redis = require('redis').createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.setTimeout(10000); // Aumenta il timeout per i test asincroni

let authToken;
let testUserId;

beforeAll(async () => {
  await redis.connect();
  // Pulisci il database e crea un utente di test
  await pool.query('DELETE FROM users WHERE username = $1', ['testuser']);
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  const result = await pool.query(
    'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id',
    ['testuser', hashedPassword, 'test@example.com']
  );
  testUserId = result.rows[0].id;

  // Ottieni un token JWT per l'utente di test
  const loginResponse = await request(app)
    .post('/auth/login')
    .send({ username: 'testuser', password: 'testpassword' });
  authToken = loginResponse.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE username = $1', ['testuser']);
  await redis.quit();
  await pool.end();
});

describe('Auth Controller Tests', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ username: 'newuser', password: 'newpassword', email: 'new@example.com' });
    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('Utente registrato con successo.');
    expect(response.body.token).toBeDefined();
  });

  it('should login an existing user', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'testuser', password: 'testpassword' });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Login effettuato con successo.');
    expect(response.body.token).toBeDefined();
  });

  it('should fail login with incorrect password', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Credenziali non valide.');
  });

  it('should request a password reset link', async () => {
    const response = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'test@example.com' });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Link per reimpostare la password inviato all\'indirizzo email fornito (se esistente).');
    // In un test più completo, potresti voler verificare l'esistenza del token in Redis
  });

  it('should reset the password with a valid token', async () => {
    // Simula la creazione di un token di reset in Redis
    const resetToken = 'test-reset-token';
    await redis.set(`resetToken:${resetToken}`, testUserId, 'EX', 3600);

    const response = await request(app)
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword: 'newsecurepassword' });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Password reimpostata con successo.');

    // Verifica che la nuova password sia stata effettivamente aggiornata (senza rivelarla)
    const user = await pool.query('SELECT password FROM users WHERE id = $1', [testUserId]);
    const passwordMatch = await bcrypt.compare('newsecurepassword', user.rows[0].password);
    expect(passwordMatch).toBe(true);

    // Verifica che il token di reset sia stato eliminato da Redis
    const tokenExists = await redis.exists(`resetToken:${resetToken}`);
    expect(tokenExists).toBe(0);
  });

  it('should fail to reset password with an invalid or expired token', async () => {
    const response = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'invalid-token', newPassword: 'newpassword' });
    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Token di reset password non valido o scaduto.');
  });

  it('should allow an authenticated user to update their password', async () => {
    const response = await request(app)
      .post('/auth/update-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentPassword: 'testpassword', newPassword: 'updatedpassword' });
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Password aggiornata con successo.');

    // Verifica che la password sia stata effettivamente aggiornata
    const user = await pool.query('SELECT password FROM users WHERE id = $1', [testUserId]);
    const passwordMatch = await bcrypt.compare('updatedpassword', user.rows[0].password);
    expect(passwordMatch).toBe(true);

    // Reimposta la password per i test successivi
    const hashedPassword = await bcrypt.hash('testpassword', 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, testUserId]);
  });

  it('should fail to update password with incorrect current password', async () => {
    const response = await request(app)
      .post('/auth/update-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'updatedpassword' });
    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('La password attuale non è corretta.');
  });

  it('should fail to update password if not authenticated', async () => {
    const response = await request(app)
      .post('/auth/update-password')
      .send({ currentPassword: 'testpassword', newPassword: 'updatedpassword' });
    expect(response.statusCode).toBe(401);
  });
});