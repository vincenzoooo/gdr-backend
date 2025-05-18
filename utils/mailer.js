const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAILHOG_HOST,
  port: process.env.MAILHOG_PORT,
  secure: false, // MailHog non richiede connessione sicura
  ignoreTLS: true, // Ignora gli errori TLS
});

exports.sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: '"RPG Game" <no-reply@rpg.com>', // Indirizzo mittente
      to: to,
      subject: subject,
      html: html,
    });
    console.log('Messaggio email inviato:', info.messageId);
  } catch (error) {
    console.error('Errore durante l\'invio dell\'email:', error);
  }
};
