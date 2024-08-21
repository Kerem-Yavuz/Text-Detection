const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createWorker } = require('tesseract.js');
const sharp = require('sharp'); // Ensure sharp is installed and required
const app = express();
const multer = require ('multer');
let randomImgName;

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
            soyad: /soy[aı]s?\s*[:\s]*([\wşŞçÇğĞıİöÖüÜ]+)/i,
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
        
        let jsonData = JSON.stringify(data, null, 2)
        addToJson(jsonData);
        

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

const imagesDir = path.join(__dirname, 'uploads/images/');


  // Yükleme işlemi için POST isteği
  app.post('/upload',  (req, res) => {
    const { imgData } = req.body;

    function generateRandomString(length) {
        // Kullanılacak karakterler: büyük ve küçük harfler, rakamlar
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
      
        // Belirtilen uzunluk kadar döngü
        for (let i = 0; i < length; i++) {
          // Rastgele bir karakter seç
          const randomIndex = Math.floor(Math.random() * characters.length);
          result += characters[randomIndex];
        }
      
        return result;
    }
      
    // 10 haneli rastgele string oluştur
    randomImgName = generateRandomString(10);

    // Extract base64 data from the data URL
    const base64Data = imgData.replace(/^data:image\/png;base64,/, '');

    const imagePath = path.join(imagesDir, `${randomImgName}.png`);

    // Ensure the uploads directory exists
     fs.mkdir(imagesDir, { recursive: true });

    // Convert base64 data to an image file using sharp
     sharp(Buffer.from(base64Data, 'base64')).toFile(imagePath);

     res.redirect("/anasayfa");
    });

    function addToJson(data) {
        try {
            // JSON formatında olduğundan emin olmak için kontrol et
            if (typeof data === 'string') {
                // JSON stringini parse et
                let dataObject = JSON.parse(data);
    
                // `dataObject` bir nesne olduğundan emin ol
                if (typeof dataObject === 'object' && !Array.isArray(dataObject)) {
                    // Yeni veriyi tanımla
                    let newData = {
                        fileName: `${randomImgName}.png`,
                    };
    
                    // Eğer `dataObject` içinde bir dizi bekleniyorsa, ekleyin
                    // veya uygun bir alanı güncelleyin
                    if (!dataObject.items) {
                        dataObject.items = [];
                    }
                    dataObject.items.push(newData);
    
                    // Güncellenmiş veriyi JSON formatına dönüştür
                    let newData2 = JSON.stringify(dataObject, null, 2);
    
                    // Veriyi 'data2.json' dosyasına yaz
                    fs.writeFile("data2.json", newData2, (err) => {
                        if (err) throw err;
                        console.log("Yeni veri eklendi");
                    });
                } else {
                    console.error("Veri bir nesne değil.");
                }
            } else {
                console.error("Veri JSON stringi formatında değil.");
            }
        } catch (err) {
            console.error("Bir hata oluştu: ", err);
        }
    }


let port = 8001;
let ip = "0.0.0.0";

let server = app.listen(port, ip, () => {
    console.log("Server is running on:", ip, port);
});



