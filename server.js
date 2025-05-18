const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');
const helmet = require('helmet'); // Importa helmet
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet()); // Applica le protezioni di sicurezza HTTP
app.use(bodyParser.json());

app.use('/auth', authRoutes);

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});