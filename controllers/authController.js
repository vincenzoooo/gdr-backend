const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redis = require('redis').createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});
const { sendEmail } = require('../utils/mailer');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

redis.on('error', err => console.log('Redis Client Error', err));
redis.connect().catch(console.error);

const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Rate limiter per le richieste di login e reset password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Limita ogni IP a 100 richieste per finestra
  message: 'Troppe richieste da questo IP, riprova tra 15 minuti.',
  standardHeaders: true,
  legacyHeaders: false,
});

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, password, email } = req.body;
    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({ message: 'Username già esistente.' });
    }
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({ message: 'Email già esistente.' });
    }
    const newUser = await User.create(username, password, email);
    const token = generateToken(newUser);
    res.status(201).json({ message: 'Utente registrato con successo.', token });
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    res.status(500).json({ message: 'Errore interno del server durante la registrazione.' });
  }
};

exports.login = [
  authLimiter,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { username, password } = req.body;
      const user = await User.findByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Credenziali non valide.' });
      }
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Credenziali non valide.' });
      }
      const token = generateToken(user);
      res.status(200).json({ message: 'Login effettuato con successo.', token });
    } catch (error) {
      console.error('Errore durante il login:', error);
      res.status(500).json({ message: 'Errore interno del server durante il login.' });
    }
  }
];

exports.forgotUsername = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'Nessun utente trovato con questa email.' });
    }
    const subject = 'Recupero Username RPG Game';
    const html = `<p>Ciao ${user.email}, il tuo username è: <strong>${user.username}</strong></p>`;
    await sendEmail(email, subject, html);
    res.status(200).json({ message: 'Username inviato all\'indirizzo email fornito (se esistente).' });
  } catch (error) {
    console.error('Errore durante il recupero username:', error);
    res.status(500).json({ message: 'Errore interno del server durante il recupero username.' });
  }
};

exports.forgotPasswordRequest = [
  authLimiter,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { email } = req.body;
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'Nessun utente trovato con questa email.' });
      }
      const resetToken = uuidv4();
      const resetLink = `http://localhost:3000/reset-password/${resetToken}`; // Assicurati di usare l'URL corretto del tuo frontend
      const expiryTime = 3600; // Token valido per 1 ora (in secondi)

      await redis.set(`resetToken:${resetToken}`, user.id, 'EX', expiryTime);

      const subject = 'Richiesta Reset Password RPG Game';
      const html = `<p>Ciao ${user.email}, hai richiesto di reimpostare la tua password.</p>
                    <p>Clicca sul seguente link per procedere: <a href="${resetLink}">${resetLink}</a></p>
                    <p>Questo link scadrà tra 1 ora.</p>`;
      await sendEmail(email, subject, html);
      res.status(200).json({ message: 'Link per reimpostare la password inviato all\'indirizzo email fornito (se esistente).' });
    } catch (error) {
      console.error('Errore durante la richiesta di reset password:', error);
      res.status(500).json({ message: 'Errore interno del server durante la richiesta di reset password.' });
    }
  }
];

exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { token, newPassword } = req.body;
    const userId = await redis.get(`resetToken:${token}`);
    if (!userId) {
      return res.status(400).json({ message: 'Token di reset password non valido o scaduto.' });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
    await redis.del(`resetToken:${token}`);
    res.status(200).json({ message: 'Password reimpostata con successo.' });
  } catch (error) {
    console.error('Errore durante il reset della password:', error);
    res.status(500).json({ message: 'Errore interno del server durante il reset della password.' });
  }
};

exports.updatePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Assumiamo che l'utente sia autenticato tramite un middleware e l'ID sia disponibile in req.user

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user.rows[0]) {
      return res.status(404).json({ message: 'Utente non trovato.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.rows[0].password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'La password attuale non è corretta.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.status(200).json({ message: 'Password aggiornata con successo.' });
  } catch (error) {
    console.error('Errore durante l\'aggiornamento della password:', error);
    res.status(500).json({ message: 'Errore interno del server durante l\'aggiornamento della password.' });
  }
};