import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

const API_KEY = 'AIzaSyDuPPrRof_WLG6tT0vGbs_uRKjfnTYi2VI'; // Replace with your actual API key

const injuryForm = document.getElementById('injuryForm');
const injuryImage = document.getElementById('injuryImage');
const injuryImageLabel = document.getElementById('injuryImageLabel');
const aiResponse = document.getElementById('aiResponse');
const generatingloader = document.getElementById('generatingloader');

let imageBase64;

injuryImage.addEventListener('change', function(e) {
    updateFileLabel(e.target, injuryImageLabel);
});

function updateFileLabel(input, label) {
    if (input.files && input.files[0]) {
        label.textContent = input.files[0].name;
        label.classList.add('file-selected');
    } else {
        label.textContent = 'Upload Injury Image';
        label.classList.remove('file-selected');
    }
}

injuryForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    generatingloader.style.display = 'block';
    aiResponse.innerHTML = '';

    try {
        const file = injuryImage.files[0];
        const description = document.getElementById('injuryDescription').value;

        if (!file && !description) {
            alert('Please upload an image of the injury or provide a description.');
            generatingloader.style.display = 'none';
            return;
        }

        if (file) {
            console.log('Processing injury image...');
            imageBase64 = await fileToBase64(file);
            console.log('Injury image processed.');
        } else {
            imageBase64 = null;
        }

        await generateResponse(description);
    } catch (e) {
        console.error('Error in form submission:', e);
        aiResponse.innerHTML = `<p class="error">Error: ${e.message || 'An unknown error occurred'}</p>`;
        generatingloader.style.display = 'none';
    }
});

async function generateResponse(description) {
    try {
        const prompt = "You are a first aid expert. Analyze the uploaded injury image and provide detailed first aid instructions and next steps. Format your response in HTML with appropriate tags for headings, paragraphs, and lists. Please ensure your response adheres to content safety guidelines.";
        let contents = [
            {
                role: 'user',
                parts: [
                    { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
                    { text: prompt },
                ]
            }
        ];

        console.log('Calling Gemini API...');
        const response = await callGeminiAPI(contents);
        console.log('Gemini API response received');

        if (response.trim() === '') {
            throw new Error('The AI was unable to generate a response for this image. This may be due to content safety measures or an unclear image.');
        }

        aiResponse.innerHTML = response;
        generatingloader.style.display = 'none';
    } catch (error) {
        console.error('Error in generateResponse:', error);
        let errorMessage = error.message;
        if (error.message.includes('OTHER')) {
            errorMessage = 'The AI was unable to process this image due to content safety measures. Please try a different image or describe the injury in text instead.';
        }
        aiResponse.innerHTML = `<p class="error">Error: ${errorMessage}</p>`;
        generatingloader.style.display = 'none';
    }
}

async function callGeminiAPI(contents) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
        ],
    });

    try {
        const result = await model.generateContentStream({ contents });
        let buffer = [];
        for await (let response of result.stream) {
            buffer.push(response.text());
        }
        return buffer.join('');
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        if (error.message.includes('OTHER')) {
            throw new Error('The AI was unable to process this image due to content safety measures.');
        } else {
            throw error;
        }
    }
}

async function fileToBase64(file) {
    try {
        console.log('Starting fileToBase64 for file:', file.name);
        const processedBlob = await processImage(file);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                console.log('fileToBase64 completed successfully');
                resolve(base64String);
            };
            reader.onerror = (error) => {
                console.error('Error in FileReader:', error);
                reject(error);
            };
            reader.readAsDataURL(processedBlob);
        });
    } catch (error) {
        console.error('Error in fileToBase64:', error);
        throw new Error(`Error processing ${file.name}: ${error.message}`);
    }
}

async function processImage(file) {
    return new Promise(async (resolve, reject) => {
        console.log('Starting processImage for file:', file.name);
        
        let processedFile = file;
        
        if ((file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) && typeof heic2any !== 'undefined') {
            try {
                const blob = await heic2any({
                    blob: file,
                    toType: 'image/jpeg',
                    quality: 0.8
                });
                processedFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
                console.log('HEIC file converted to JPEG');
            } catch (error) {
                console.error('Error converting HEIC to JPEG:', error);
            }
        } else if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
            console.warn('HEIC file detected, but heic2any library is not available. Attempting to process without conversion.');
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 800;
                const maxHeight = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(function(blob) {
                    console.log('processImage completed successfully');
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = function(error) {
                console.error('Error loading image:', error);
                reject(error);
            };
            img.src = e.target.result;
        };
        reader.onerror = function(error) {
            console.error('Error reading file:', error);
            reject(error);
        };
        reader.readAsDataURL(processedFile);
    });
}
