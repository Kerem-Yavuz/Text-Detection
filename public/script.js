let imgElement = document.getElementById("imageSrc");
let inputElement = document.getElementById("fileInput");
let canvas = document.getElementById("canvasOutput");
let ctx = canvas.getContext('2d');
let points = [];
const maxPoints = 4;
let originalImageData = null; // To store the original image data for OpenCV processing

inputElement.addEventListener("change", (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
    imgElement.onload = function() {
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    imgElement.src = '';
    inputElement.value = '';
    points = [];
    
    document.getElementById("detectedText").textContent = "Text";
}


function processImage(imageData) {
    let img = new Image();
    img.onload = function() {
        let src = cv.imread(img);
        
        let threshold = new cv.Mat();
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();

        // Convert to grayscale and apply threshold or edge detection
        threshold = filter(src);

        // Find contours
        cv.findContours(threshold, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

        // Initialize the output image
        let dst = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);

        // Combine and draw contours for larger areas
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let rect = cv.boundingRect(cnt);

            if(rect.width !== src.cols && rect.height !== src.rows)
            {
            // Filter contours based on size to avoid small text areas
            if (rect.width > src.cols / 3 && rect.height > src.rows / 3) { // Adjust these thresholds as needed

                // Approximate the contour to a polygon with fewer vertices
                let approx = new cv.Mat();
                cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);

                if (approx.rows === 4) {  // If the contour has 4 points (corners)
                    let points = [];
                    for (let j = 0; j < 4; j++) {
                        let corner = new cv.Point(approx.data32S[j * 2], approx.data32S[j * 2 + 1]);
                        cv.circle(dst, corner, 5, new cv.Scalar(255, 0, 0), 2); // Draw the corners
                        points.push([corner.x, corner.y]);
                        console.log(`Corner ${j + 1}:`, corner);
                    }
                    orderPoints(points);
                    // New Perspective Transformation
                    let input_pts = new cv.Mat(4, 1, cv.CV_32FC2);
                    let output_pts = new cv.Mat(4, 1, cv.CV_32FC2);
                    calculateDimensions(points);
                    // New Perspective Transformation
                    window.input_pts.forEach((pt, i) => {
                        input_pts.floatPtr(i)[0] = pt[0];
                        input_pts.floatPtr(i)[1] = pt[1];
                    });
                    
                    
                    output_pts.floatPtr(0)[0] = 0;
                    output_pts.floatPtr(0)[1] = 0;
                    output_pts.floatPtr(1)[0] = window.max_width;
                    output_pts.floatPtr(1)[1] = 0;
                    output_pts.floatPtr(2)[0] = window.max_width;
                    output_pts.floatPtr(2)[1] = window.max_height;
                    output_pts.floatPtr(3)[0] = 0;
                    output_pts.floatPtr(3)[1] = window.max_height;
                    

                    let matrix = cv.getPerspectiveTransform(input_pts, output_pts);
                    let warped = new cv.Mat();
                    cv.warpPerspective(src, warped, matrix, new cv.Size(window.max_width, window.max_height), cv.INTER_LINEAR);
                    threshold = filter(warped);


                    let canvasId = `canvasoutput${i}`;

            // Create a new canvas element
            let canvas2 = document.createElement('canvas');
            canvas2.id = canvasId;
            canvas2.width = threshold.cols;
            canvas2.height = threshold.rows;
            document.body.appendChild(canvas2); // Append the canvas to the body (or any container you prefer)

            

            // Display the image on the canvas
            cv.imshow(canvasId, threshold);

            // Convert canvas to data URL
            let canvasElement = document.getElementById(canvasId);
            let dataURL = canvasElement.toDataURL('image/png');

                    //cv.imshow('canvasOutput', threshold);
                    //let dataURL = document.getElementById("canvasOutput").toDataURL("image/png");
                    performOCR(dataURL);
                    
                    // Clean up
                    matrix.delete();
                    warped.delete();
                    input_pts.delete();
                    output_pts.delete();
                }

                // Clean up the approximation matrix
                approx.delete();
            }
            }
        }

        cv.imshow('canvasoutputrect', dst);

        // Clean up
        src.delete();
        threshold.delete();
        contours.delete();
        hierarchy.delete();
        dst.delete();
    };
    img.src = imageData;
}


function filter(input)
{
    let gray = new cv.Mat();
    let threshold = new cv.Mat();
    cv.cvtColor(input, gray, cv.COLOR_RGB2GRAY, 0);

        // Apply binary thresholding
    cv.adaptiveThreshold(gray, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 13);
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


function performOCR(imageData) {
    fetch(imageData)
        .then(res => res.arrayBuffer())
        .then(buffer => {
            const blob = new Blob([buffer]);
            console.log("loading");
            Tesseract.recognize(
                blob,
                'eng+tur', // Language
                {  
                    langPath: "./tessdata",
                    oem: 3, // OCR Engine Mode
                    psm: 6, // Page Segmentation Mode
                }
            ).then(({ data: { text } }) => {
                console.log('Detected text:', text);
                document.getElementById('detectedText').textContent = text
            }).catch(err => {
                console.error('OCR error:', err);
            });
        });
}