import os
import re
import json
import base64
from io import BytesIO
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    print("OpenCV not available, using basic image processing")

import pytesseract
import qrcode
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Configure Tesseract path for macOS (adjust if needed)
# pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

@dataclass
class DrugInfo:
    name: str = ""
    batch_number: str = ""
    expiry_date: str = ""
    manufacturing_date: str = ""
    dosage: str = ""
    manufacturer: str = ""
    registration_number: str = ""
    barcode: str = ""

class DrugSpecExtractor:
    def __init__(self):
        self.common_patterns = {
            'batch': [
                r'(?:lote|batch|lot)\s*[:\-]?\s*([A-Z0-9]+)',
                r'(?:L|B)\s*[:\-]?\s*([A-Z0-9]+)',
                r'lote\s+([A-Z0-9]+)'
            ],
            'expiry': [
                r'(?:venc|exp|validade|expires?)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
                r'(?:val|valid)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
                r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})'
            ],
            'manufacturing': [
                r'(?:fab|mfg|fabr)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})',
                r'fabricação\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})'
            ],
            'dosage': [
                r'(\d+\s*mg)',
                r'(\d+\s*ml)',
                r'(\d+\s*g)',
                r'(\d+\s*mcg)',
                r'(\d+\s*ui)'
            ],
            'registration': [
                r'(?:ms|reg|registro)\s*[:\-]?\s*([0-9\.\-]+)',
                r'registro\s+ms\s*[:\-]?\s*([0-9\.\-]+)'
            ]
        }

    def preprocess_image(self, image):
        """Preprocess image for better OCR results"""
        if not HAS_CV2:
            # Return the PIL image as-is if OpenCV is not available
            return image
            
        # Convert PIL to OpenCV format
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        if len(cv_image.shape) == 3:
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = cv_image

        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Morphological operations to clean up
        kernel = np.ones((1, 1), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # Convert back to PIL Image
        return Image.fromarray(cleaned)

    def extract_text_from_image(self, image):
        """Extract text from image using OCR"""
        try:
            # Preprocess image
            processed = self.preprocess_image(image)
            
            # OCR configuration for better results
            config = '--oem 3 --psm 6 -l por+eng'
            
            # Extract text
            text = pytesseract.image_to_string(processed, config=config)
            return text.strip()
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""

    def parse_drug_info(self, text: str) -> DrugInfo:
        """Parse drug information from extracted text"""
        drug_info = DrugInfo()
        text_lower = text.lower()
        
        # Extract drug name (first meaningful line, often the largest text)
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        if lines:
            # Find the longest line that's likely the drug name
            potential_names = [line for line in lines[:5] if len(line) > 3 and not any(char.isdigit() for char in line[:3])]
            if potential_names:
                drug_info.name = potential_names[0]

        # Extract information using patterns
        for field, patterns in self.common_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text_lower, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    if field == 'batch':
                        drug_info.batch_number = value.upper()
                    elif field == 'expiry':
                        drug_info.expiry_date = value
                    elif field == 'manufacturing':
                        drug_info.manufacturing_date = value
                    elif field == 'dosage':
                        drug_info.dosage = value
                    elif field == 'registration':
                        drug_info.registration_number = value
                    break

        # Extract manufacturer (look for common pharmaceutical company patterns)
        manufacturer_patterns = [
            r'(?:laboratório|lab|pharma|farmacêutica)\s+([a-zA-Z\s]+)',
            r'([a-zA-Z\s]+)\s+(?:laboratório|lab|pharma|farmacêutica)',
        ]
        
        for pattern in manufacturer_patterns:
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                drug_info.manufacturer = match.group(1).strip().title()
                break

        return drug_info

    def generate_qr_code(self, drug_info: DrugInfo) -> str:
        """Generate QR code with drug information"""
        # Create data structure for QR code
        qr_data = {
            "type": "pharmaceutical_product",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "name": drug_info.name,
                "batch_number": drug_info.batch_number,
                "expiry_date": drug_info.expiry_date,
                "manufacturing_date": drug_info.manufacturing_date,
                "dosage": drug_info.dosage,
                "manufacturer": drug_info.manufacturer,
                "registration_number": drug_info.registration_number
            }
        }
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        
        qr.add_data(json.dumps(qr_data))
        qr.make(fit=True)
        
        # Create QR code image
        qr_image = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 for web display
        buffer = BytesIO()
        qr_image.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return qr_base64

# FastAPI application
app = FastAPI(title="GAUGE Drug Spec Extractor", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize extractor
extractor = DrugSpecExtractor()

@app.post("/extract-drug-info")
async def extract_drug_info(file: UploadFile = File(...)):
    """Extract drug information from uploaded image and generate QR code"""
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image
        contents = await file.read()
        image = Image.open(BytesIO(contents))
        
        # Extract text from image
        extracted_text = extractor.extract_text_from_image(image)
        
        if not extracted_text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the image")
        
        # Parse drug information
        drug_info = extractor.parse_drug_info(extracted_text)
        
        # Generate QR code
        qr_code_base64 = extractor.generate_qr_code(drug_info)
        
        return JSONResponse({
            "success": True,
            "extracted_text": extracted_text,
            "drug_info": {
                "name": drug_info.name,
                "batch_number": drug_info.batch_number,
                "expiry_date": drug_info.expiry_date,
                "manufacturing_date": drug_info.manufacturing_date,
                "dosage": drug_info.dosage,
                "manufacturer": drug_info.manufacturer,
                "registration_number": drug_info.registration_number
            },
            "qr_code": qr_code_base64,
            "qr_data_url": f"data:image/png;base64,{qr_code_base64}"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "drug-spec-extractor"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)