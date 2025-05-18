const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/authMiddleware'); // Middleware per l'autenticazione JWT

router.post(
  '/register',
  [
    body('username').trim().notEmpty().withMessage('L\'username è richiesto.').isLength({ min: 3, max: 50 }).withMessage('L\'username deve essere tra 3 e 50 caratteri.').escape(),
    body('email').trim().notEmpty().withMessage('L\'email è richiesta.').isEmail().withMessage('Inserisci un\'email valida.').normalizeEmail(),
    body('password').notEmpty().withMessage('La password è richiesta.').isLength({ min: 6 }).withMessage('La password deve essere almeno di 6 caratteri.'),
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('L\'username è richiesto.').escape(),
    body('password').notEmpty().withMessage('La password è richiesta.'),
  ],
  authController.login
);

router.post(
  '/forgot-username',
  [
    body('email').trim().notEmpty().withMessage('L\'email è richiesta.').isEmail().withMessage('Inserisci un\'email valida.').normalizeEmail(),
  ],
  authController.forgotUsername
);

router.post(
  '/forgot-password',
  [
    body('email').trim().notEmpty().withMessage('L\'email è richiesta.').isEmail().withMessage('Inserisci un\'email valida.').normalizeEmail(),
  ],
  authController.forgotPasswordRequest
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Il token è richiesto.'),
    body('newPassword').notEmpty().withMessage('La nuova password è richiesta.').isLength({ min: 6 }).withMessage('La nuova password deve essere almeno di 6 caratteri.'),
  ],
  authController.resetPassword
);

router.post(
  '/update-password',
  authenticateToken, // Richiede l'autenticazione JWT
  [
    body('currentPassword').notEmpty().withMessage('La password attuale è richiesta.'),
    body('newPassword').notEmpty().withMessage('La nuova password è richiesta.').isLength({ min: 6 }).withMessage('La nuova password deve essere almeno di 6 caratteri.'),
  ],
  authController.updatePassword
);

module.exports = router;