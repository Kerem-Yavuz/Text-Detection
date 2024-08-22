let imgElement = document.getElementById("imageSrc");
let inputElement = document.getElementById("fileInput");
let canvas = document.getElementById("canvasOutput");
let ctx = canvas.getContext('2d');
let points = [];
const maxPoints = 4;
let originalImageData = null; // To store the original image data for OpenCV processing


function detectFace() {
    
        var faceCanvas = document.getElementById("outputFace"); // faceCanvas is the id of faceCanvas tag

        // Load the image from the canvas
        var src = cv.imread(faceCanvas);
        var dst = new cv.Mat();
        var gray = new cv.Mat();
        var faces = new cv.RectVector();
        var classifier = new cv.CascadeClassifier();
        var utils = new Utils('errorMessage');
        var faceCascadeFile = 'haarcascade_frontalface_default.xml'; // path to xml

        // Load the classifier
        utils.createFileFromUrl(faceCascadeFile, faceCascadeFile, () => {
            classifier.load(faceCascadeFile); // Load the cascade from file 

            // Process the image after the cascade has been loaded
            processfaceCanvas();
        });

        function processfaceCanvas() {
            // Convert the image to grayscale
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

            try {
                // Detect faces
                classifier.detectMultiScale(gray, faces, 1.1, 3, 0);
                console.log(faces.size());
            } catch (err) {
                console.log(err);
            }

            // Draw rectangles around the detected faces
            for (let i = 0; i < faces.size(); ++i) {
                let face = faces.get(i);

                if(face.width >= src.cols*0.05 && face.height >= src.rows*0.05)
                {
                let point1 = new cv.Point(face.x-30, face.y-50);
                let point2 = new cv.Point(face.x + face.width+30, face.y + face.height+30);
                cv.rectangle(src, point1, point2, [255, 0, 0, 255],src.cols/300);
                }
            }

            // Display the result on the canvas
            cv.imshow("outputFace", src);

            // Clean up
            src.delete();
            dst.delete();
            gray.delete();
            faces.delete();
            classifier.delete();
        }
    
}



inputElement.addEventListener("change", (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
    imgElement.onload = function() {
        console.log("Image uploaded Successfully");
        // Set canvas dimensions and draw the original image
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        ctx.drawImage(imgElement, 0, 0);

        // Store original image data for OpenCV processing
        originalImageData = canvas.toDataURL('image/png');
        
        // Clear points and add event listener for clicks
        points = [];
        calculateDimensions(points);
        // Process the original image with OpenCV
        processImage(originalImageData);
    };
}, false);
function reset()
{   
    canvas.width = 0;
    canvas.height = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    imgElement.src = '';
    inputElement.value = '';
    points = [];

    document.getElementById("outputFace").remove();

    let faceCanvas = document.createElement('canvas');
    faceCanvas.id = "outputFace";
    faceCanvas.width = 0;
    faceCanvas.height = 0;
    faceCanvas.style.display = "block";
    document.body.appendChild(faceCanvas);
    

    document.getElementById("canvasoutputrect").remove();

    let canvasdots = document.createElement('canvas');
    canvasdots.id = "canvasoutputrect";
    canvasdots.width = 0;
    canvasdots.height = 0;
    canvasdots.style.display = "none";
    document.body.appendChild(canvasdots);

    let outputs = document.getElementsByClassName("outputs");
    while(outputs.length > 0){
        outputs[0].parentNode.removeChild(outputs[0]);
    }
    document.getElementById("detectedText").textContent = "Text";

    console.log("reseted");
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'r' || event.key === 'R') {
        reset();
    }
});


function processImage(imageData) {
    let img = new Image();
    img.onload = function() {
        let src = cv.imread(img);
        let threshold = new cv.Mat();
        

        // Convert to grayscale and apply threshold or edge detection
        threshold = filter(src);

        
        
        
        cv.imshow("outputFace", src);//output into outputFace so that detectFace function can get it from there
        detectFace();

        cv.imshow("canvasOutput", threshold);//output it into canvasOutput so we can get the data and send it to the performOCR
        let dataURL = document.getElementById("canvasOutput").toDataURL("image/png");
        performOCR(dataURL);

        // Clean up
        src.delete();
        threshold.delete();
    };
    img.src = imageData;
}


function filter(input)
{
    let gray = new cv.Mat();
    let threshold = new cv.Mat();
    cv.cvtColor(input, gray, cv.COLOR_RGB2GRAY, 0);

        // Apply binary thresholding
    cv.adaptiveThreshold(gray, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 51,15);
    return threshold;
}

function orderPoints(points)
{
        
        points.sort((a, b) => a[1] - b[1]);
        
        let smallestTwo = points.slice(0, 2);
        let largestTwo = points.slice(2);
       
        smallestTwo.sort((a, b) => a[0] - b[0]);
        largestTwo.sort((a, b) => b[0] - a[0]);

        points[0] = smallestTwo[0]; //top-left
        points[1] = smallestTwo[1]; //top-right
        points[2] = largestTwo[0];  //bottom-right
        points[3] = largestTwo[1]; // bottom-left

        //it still takes a little bit of the line so we will take 5px inside each point
        points[0][0] = points[0][0] + 5;
        points[0][1] = points[0][1] + 5;
        points[1][0] = points[1][0] - 5;
        points[1][1] = points[1][1] + 5;
        points[2][0] = points[2][0] - 5;
        points[2][1] = points[2][1] - 5;
        points[3][0] = points[3][0] + 5;
        points[3][1] = points[3][1] - 5;
}





function calculateDimensions(points) {
    if (points.length < 4) return;

    function distance(pt1, pt2) {
        return Math.sqrt(Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2));
    }

    let pt1 = points[0]; // Top-left
    let pt2 = points[1]; // Top-right
    let pt3 = points[2]; // Bottom-right
    let pt4 = points[3]; // Bottom-left

    let width_1 = distance(pt1, pt2);
    let width_2 = distance(pt3, pt4);
    let height_1 = distance(pt1, pt4);
    let height_2 = distance(pt2, pt3);

    let max_height = Math.max(height_1, height_2);
    let max_width = Math.max(width_1, width_2);

    window.max_height = Math.round(max_height);
    window.max_width = Math.round(max_width);

    // Store the points for perspective transformation
    window.input_pts = points.map(p => [p[0], p[1]]);
}


function performOCR(imgData) {
    fetch('/performOCR', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imgData }) // Ensure imgData is a string
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('detectedText').textContent = data.text;
        console.log(data.text);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}