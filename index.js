const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createWorker } = require('tesseract.js');
const sharp = require('sharp'); // Ensure sharp is installed and required
const app = express();
const multer = require ('multer');


const uploadsDir = path.join(__dirname, 'uploads');
const uploadImagesDir = path.join(__dirname, 'uploads','images');


app.use(express.json({ limit: '50mb' })); // Increase the limit if needed
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/data')));
app.use('/uploads/images', express.static(uploadImagesDir));

app.get('/getImages', async (req, res) => { // Changed
    try {
        const files = await fs.readdir(uploadImagesDir);
        const images = files.filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file));

        let imageHTML = images.map(image => `<img src="/uploads/images/${image}" alt="${image}" style="width:150px; margin:10px;">`).join('');
        imageHTML = `<html><body>${imageHTML}</body></html>`;

        res.send(imageHTML);
    } catch (err) {
        console.error('Error reading images directory:', err);
        res.status(500).send('Error reading images directory');
    }
});

app.get('/anasayfa', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/anasayfa');
});
let randomImgName;

app.post('/performOCR', async (req, res) => {
    try {
        if (!req.body || !req.body.imgData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        const { imgData } = req.body;

        
        const base64Data = imgData.replace(/^data:image\/png;base64,/, '');

        const imagePath = path.join(uploadsDir, 'temp.png');//create temporary image

        
        await fs.mkdir(uploadsDir, { recursive: true });

        
        await sharp(Buffer.from(base64Data, 'base64')).toFile(imagePath);

        
        const worker = await createWorker();

        
        await worker.setParameters({// whitelist of chars that we want to see in our ocr result
            //tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzçğıöşüÇĞİÖŞÜ1234567890'
        });

        // Perform OCR on the image file
        const { data: { text } } = await worker.recognize(imagePath , 'tur');
        console.log('Detected text:', text);
        

        const ocrOutput = replaceNewlines(text);

        const data = {};
        
        // Helper function to clean and normalize text
        function cleanText(text) {
            return text.replace(/[\s:]+/g, ' ').trim().toLowerCase();
        }

        function replaceNewlines(text) {
            return text.replace(/\n+/g, ' ');
        }
        
        // Patterns for extraction with potential OCR variations
        const patterns = {
            tckimlikno: /t\.?c\.?\s*kimlik\s*no\s*[:\s]*(\d{11})/i, // T.C. Kimlik No - 11 haneli
            ad: /ad[iı]\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i,
            soyad: /soyadı\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i,
            ogrencino: /öğrenci\s*no\s*[:\s]*(\d{8})/i, // Öğrenci No - 8 haneli
            fakulte: /fak\.\s*\/?\s*ens\.\s*\/?\s*yo\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ\s\.]+)/i,
            bolum: /bölüm\s*\/\s*program\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ\s]+)/i
        };
        
        // Extract data using patterns
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = ocrOutput.match(pattern);
            if (match) {
                data[key] = match[1].trim();
            }
        }
        
        // Log the extracted data
        console.log(JSON.stringify(data, null, 2));

        randomImgName = generateRandomString(10);//create global name for the image
        
        addToJson(JSON.stringify(data, null, 2));//add the name of the image to the json file
        
        

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

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

const imagesDir = path.join(__dirname, 'uploads/images/');



app.post('/upload', async (req, res) => {
    try {
        const { imgData } = req.body;


        // Extract base64 data from the data URL
        const base64Data = imgData.replace(/^data:image\/png;base64,/, '');

        const imagePath = path.join(imagesDir, `${randomImgName}.png`);

        // Ensure the uploads directory exists
        await fs.mkdir(imagesDir, { recursive: true });

        // Convert base64 data to an image file using sharp
        await sharp(Buffer.from(base64Data, 'base64')).toFile(imagePath);

        res.redirect("/anasayfa");
    } catch (error) {
        console.error('Error processing image upload:', error);
        res.status(500).send('An error occurred while processing your request.');
    }
});

function addToJson(data) {
        
        if (typeof data === 'string') {
            //Parses Json String
            let dataObject = JSON.parse(data);

            // Check dataObject
            if (typeof dataObject === 'object' && !Array.isArray(dataObject)) {
                //Assigns new Data
                let newData = {
                    fileName: `${randomImgName}.png`,
                };
    
                Object.assign(dataObject,newData);
    
                // write the updated json into newjson
                let newJson = JSON.stringify(dataObject, null, 2);
    
                // write the newJson into to the data.json file
                fs.writeFile("data.json", newJson, (err) => {
                    if (err) throw err;
                    console.log("newData added");
                   });
            } 

        } 
}


let port = 8001;
let ip = "0.0.0.0";

let server = app.listen(port, ip, () => {
    console.log("Server is running on:", ip, port);
});



