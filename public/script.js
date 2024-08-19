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
    canvas.width = 0;
    canvas.height = 0;

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
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        

        // Convert to grayscale and apply threshold or edge detection
        threshold = filter(src);

        function detectAndDrawCircles(src) {
            // Convert to grayscale if needed
            // Apply HoughCircles
            let circles = new cv.Mat();
            cv.HoughCircles(src, circles, cv.HOUGH_GRADIENT, 1, 20, 50, 30, 0, 0);
        
            // Convert to uint16 and round
            let circlesArray = circles.data32F;
            let numCircles = circles.rows;
        
            // Draw circles
            for (let i = 0; i < numCircles; i++) {
                let x = Math.round(circlesArray[i * 3]);
                let y = Math.round(circlesArray[i * 3 + 1]);
                let radius = Math.round(circlesArray[i * 3 + 2]);
        
                // Draw the outer circle
                cv.circle(src, new cv.Point(x, y), radius, new cv.Scalar(0, 255, 0), 2);
        
                // Draw the center of the circle
                cv.circle(src, new cv.Point(x, y), 2, new cv.Scalar(0, 0, 255), 3);
            }
        
            // Clean up
            circles.delete();
        }
        //detectAndDrawCircles(threshold);

        /*cv.imshow("canvasOutput", threshold);
        let dataURL = document.getElementById("canvasOutput").toDataURL("image/png");
        performOCR(dataURL);*/

        // Find contours
        cv.findContours(threshold, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        console.log("contours applied");
        // Initialize the output image
        let dst = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
        let send = 0;
        // Combine and draw contours for larger areas
        
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let rect = cv.boundingRect(cnt);

            if(rect.width !== src.cols && rect.height !== src.rows)
            {
                // Filter contours based on size to avoid small text areas
                if (rect.width > src.cols * 0.30  && rect.height > src.rows *0.30 ) { // Adjust these thresholds as needed

                    // Approximate the contour to a polygon with fewer vertices
                    let approx = new cv.Mat();
                    cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);

                    if (approx.rows === 4) {  // If the contour has 4 points (corners)
                        let points = [];
                        for (let j = 0; j < 4; j++) {
                            let corner = new cv.Point(approx.data32S[j * 2], approx.data32S[j * 2 + 1]);
                            cv.circle(dst, corner, 5, new cv.Scalar(255, 0, 0), 20); // Draw the corners
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
                        send++;
                    
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
                        console.log("warped");
                        threshold = filter(warped);


                        let canvasId = `canvasoutput${i}`;
            
            
                        // Create a new canvas element
                        let canvas2 = document.createElement('canvas');
                        canvas2.id = canvasId;
                        canvas2.width = threshold.cols;
                        canvas2.height = threshold.rows;
                        canvas2.classList = "outputs";
                        
                        document.body.appendChild(canvas2); // Append the canvas to the body (or any container you prefer)

            

                        // Display the image on the canvas
                        cv.imshow(canvasId, threshold);

                        // Convert canvas to data URL
                        let canvasElement = document.getElementById(canvasId);
                        let dataURL = canvasElement.toDataURL('image/png');

                        //cv.imshow('canvasOutput', threshold);
                        //let dataURL = document.getElementById("canvasOutput").toDataURL("image/png");
                        if(send === 1)
                        {
                            console.log("sended to ocr");
                            performOCR(dataURL);
                            
                        }
                    
                    
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
    cv.adaptiveThreshold(gray, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 51,13);
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