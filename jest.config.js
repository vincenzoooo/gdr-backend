module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  forceExit: true, // Forza l'uscita dopo i test (potrebbe essere necessario per la chiusura delle connessioni)
  clearMocks: true,
};