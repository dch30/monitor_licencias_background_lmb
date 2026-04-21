// app.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: '¡Hola desde Express en AWS Lambda!' });
});

module.exports = app;
