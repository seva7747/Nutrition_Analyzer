import { useRef, useState } from 'react';
import './index.css';

const GEMINI_API_KEY = "AIzaSyDeU-OHLusFr7a_3MnlvpZ8P9VzgNqSB5E";

export default function App() {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = take front photo, 2 = take back photo
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (error) {
      alert("Camera access denied: " + error.message);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvasRef.current.toDataURL('image/jpeg', 0.7);
      
      if (step === 1) {
        setFrontImage(imageData);
        setStep(2);
        stopCamera();
      } else if (step === 2) {
        setBackImage(imageData);
        stopCamera();
        analyzeGroceryItem(frontImage, imageData);
      }
    }
  };

  const fileToBase64 = (dataUrl) => {
    // Already in base64 format from canvas.toDataURL
    return dataUrl.split(',')[1];
  };

  const analyzeGroceryItem = async (frontDataUrl, backDataUrl) => {
    setLoading(true);
    try {
      console.log("🧠 Analyzing grocery item and nutrition facts...");
      
      const frontBase64 = fileToBase64(frontDataUrl);
      const backBase64 = fileToBase64(backDataUrl);

      if (!frontBase64 || !backBase64) throw new Error("Failed to process images");

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const geminiBody = {
        contents: [{
          parts: [
            {
              text: `You are a nutrition expert helping elderly people understand grocery items. 
              
The user has provided:
1. A photo of the front of a grocery product
2. A photo of the nutrition facts label (back)

Please analyze both images and provide:
1. Product Name and Brand
2. Key Serving Information (serving size, servings per container)
3. Critical Nutrition Facts (calories, sodium, sugar, fiber, protein)
4. Important Warnings or Considerations:
   - Is it suitable for diabetics? (high sugar warning?)
   - Does it contain common allergens? (nuts, dairy, gluten, soy, etc.)
   - Is it kosher? (if labeled)
   - Is it gluten-free? (if labeled)
   - Any other dietary restrictions people should be aware of?

Format your response as a clear, easy-to-read paragraph for seniors with:
- Simple language (avoid medical jargon)
- Key points in bold
- Important warnings in ALL CAPS if critical

Keep it concise but informative.`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: frontBase64
              }
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: backBase64
              }
            }
          ]
        }]
      };

      console.log("📤 Sending request to Gemini API...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const geminiResp = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log("✓ Got response from Gemini, status:", geminiResp.status);

      const geminiData = await geminiResp.json();

      if (!geminiResp.ok) {
        console.error("❌ Gemini error response:", geminiData);
        throw new Error(geminiData?.error?.message || `Gemini API error: ${geminiResp.status}`);
      }

      const analysisText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Unable to analyze product";
      console.log("✅ Analysis complete:", analysisText);

      setAnalysis(analysisText);

    } catch (error) {
      console.error("💀 Error:", error);
      alert("Analysis Error: " + error.message);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setFrontImage(null);
    setBackImage(null);
    setAnalysis(null);
    setStep(1);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📦 Grocery Item Analyzer</h1>
        <p className="subtitle">For Seniors: Get Important Nutrition Information</p>
      </div>

      {/* Camera View */}
      {cameraActive && (
        <div className="camera-container">
          <video ref={videoRef} autoPlay playsInline></video>
          <button className="capture-btn" onClick={capturePhoto}>📷 Capture Photo</button>
          <button className="close-btn" onClick={stopCamera}>✕ Close Camera</button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      {/* STEP 1: TAKE FRONT PHOTO */}
      {step === 1 && !frontImage && !cameraActive && (
        <div className="instruction-box">
          <p className="instruction-text">Step 1: Take a photo of the FRONT of the product</p>
          <button className="button primary-btn" onClick={startCamera}>
            📷 Open Camera
          </button>
        </div>
      )}

      {/* SHOW FRONT IMAGE */}
      {frontImage && (
        <div className="image-container">
          <p className="image-label">✓ Front Photo Captured</p>
          <img src={frontImage} alt="Front of product" className="preview-img" />
        </div>
      )}

      {/* STEP 2: TAKE BACK PHOTO (NUTRITION LABEL) */}
      {step === 2 && frontImage && !backImage && !cameraActive && (
        <div className="instruction-box">
          <p className="instruction-text">Step 2: Take a photo of the BACK (Nutrition Label)</p>
          <button className="button primary-btn" onClick={startCamera}>
            📷 Open Camera
          </button>
        </div>
      )}

      {/* SHOW BACK IMAGE */}
      {backImage && (
        <div className="image-container">
          <p className="image-label">✓ Nutrition Label Captured</p>
          <img src={backImage} alt="Nutrition label" className="preview-img" />
        </div>
      )}

      {/* LOADING INDICATOR */}
      {loading && (
        <div className="loading-box">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing nutrition information...</p>
        </div>
      )}

      {/* ANALYSIS RESULTS */}
      {analysis && (
        <div className="analysis-container">
          <div className="analysis-box">
            <h2 className="analysis-title">📋 Analysis Results:</h2>
            <p className="analysis-text">{analysis}</p>
          </div>

          <button className="button reset-btn" onClick={resetAnalysis}>
            🔄 Scan Another Product
          </button>
        </div>
      )}
    </div>
  );
}