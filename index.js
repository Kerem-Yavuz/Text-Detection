const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createWorker } = require('tesseract.js');
const sharp = require('sharp'); // Ensure sharp is installed and required
const app = express();

const uploadsDir = path.join(__dirname, 'uploads');


app.use(express.json({ limit: '50mb' })); // Increase the limit if needed
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/anasayfa', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/anasayfa');
});


app.post('/performOCR', async (req, res) => {
    try {
        if (!req.body || !req.body.imgData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const { imgData } = req.body;

        // Extract base64 data from the data URL
        const base64Data = imgData.replace(/^data:image\/png;base64,/, '');

        const imagePath = path.join(uploadsDir, 'temp.png');

        // Ensure the uploads directory exists
        await fs.mkdir(uploadsDir, { recursive: true });

        // Convert base64 data to an image file using sharp
        await sharp(Buffer.from(base64Data, 'base64')).toFile(imagePath);

        // Create a Tesseract worker
        const worker = await createWorker();

        
        await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzçğıöşüÇĞİÖŞÜ1234567890'
        });

        // Perform OCR on the image file
        const { data: { text } } = await worker.recognize(imagePath , 'tur');
        console.log('Detected text:', text);
        

        const ocrOutput = text;

        const data = {};
        
        // Helper function to clean and normalize text
        function cleanText(text) {
            return text.replace(/[\s:]+/g, ' ').trim().toLowerCase();
        }
        
        // Patterns for extraction with potential OCR variations
        const patterns = {
            tckimlikno: /tckimlikno\s*[:\s]*(\d{11})/i, // Turkish ID numbers are 11 digits long
            ad: /adi\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i,
            soyad: /soyadi\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i,
            ogrencino: /sgrenci\s*no\s*[:\s]*([\d]{8})/i // Modified to 8 digits
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = cleanText(ocrOutput).match(pattern);
            if (match) {
                data[key] = match[1].trim();
            }
        }
        
        // Additional checks for specific manual extraction if necessary
        const adMatch = cleanText(ocrOutput).match(/ad\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i);
        if (adMatch) {
            data.ad = adMatch[1].trim();
        }
        
        const soyadMatch = cleanText(ocrOutput).match(/soy\s*adi\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i);
        if (soyadMatch) {
            data.soyad = soyadMatch[1].trim();
        }
        
        const tckimliknoMatch = cleanText(ocrOutput).match(/tckimlikno\s*[:\s]*(\d{11})/i);
        if (tckimliknoMatch) {
            data.tckimlikno = tckimliknoMatch[1].trim();
        }
        
        const ogrenciNoMatch = cleanText(ocrOutput).match(/ogrenci\s*no\s*[:\s]*([\d]{8})/i);
        if (ogrenciNoMatch) {
            data.ogrencino = ogrenciNoMatch[1].trim();
        }
        
        console.log(JSON.stringify(data, null, 2));

        // Terminate the worker
        await worker.terminate();

        // Delete the file after processing
        await fs.unlink(imagePath);

        res.json({ text });
    } catch (err) {
        console.error('OCR error:', err);
        res.status(500).send('Error processing image');
    }
});


let port = 8001;
let ip = "0.0.0.0";

let server = app.listen(port, ip, () => {
    console.log("Server is running on:", ip, port);
});



