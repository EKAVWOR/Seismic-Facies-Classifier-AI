const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🌍  Seismic Facies Classifier running at:`);
    console.log(`   http://localhost:${PORT}\n`);
});