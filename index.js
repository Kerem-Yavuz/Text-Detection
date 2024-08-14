var express = require('express');
var path = require('path');
var app = express();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/anasayfa', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/anasayfa');
});

let port = 8001;
let ip = "0.0.0.0";

let server = app.listen(port, ip, () => {
    console.log("Server is running on:", ip, port);
});
