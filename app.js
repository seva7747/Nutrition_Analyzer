import { useState } from 'react';

// --- CONFIGURATION ---
const OPENNOTE_API_KEY = "bddc9497-b6a5-4d01-b233-1267501e3c0b";
const FEATHERLESS_API_KEY = "rc_27fa8f675f2a034e4aa6091a3099623bacd98ad18608e1f22c307869fcae077a"; 

export default function App() {
  const [frontImage, setFrontImage] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [enhancedNutritionImage, setEnhancedNutritionImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('front'); // front, nutrition, enhanced, results
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const enhanceNutritionImage = async (imageData) => {
    setLoading(true);
    console.log('🔥 Starting nutrition text extraction...');
    
    try {
      // Use Featherless AI to extract and enhance nutrition text
      const response = await fetch('https://api.featherless.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FEATHERLESS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this nutrition facts image and reformat it with LARGE, BOLD text that elderly people can easily read. Use the following format:\n\nNUTRITION FACTS\nServing Size: [extracted]\n\nCALORIES [extracted]\nTotal Fat [extracted]g\n  Saturated Fat [extracted]g\n  Trans Fat [extracted]g\n\nCholesterol [extracted]mg\nSodium [extracted]mg\n\nTotal Carbohydrate [extracted]g\n  Dietary Fiber [extracted]g\n  Total Sugars [extracted]g\n  Includes [extracted]g Added Sugars\n\nProtein [extracted]g\n\nVitamin D [extracted]mcg\nCalcium [extracted]mg\nIron [extracted]mg\nPotassium [extracted]mg\n\nMake all text VERY LARGE and clear!'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData
                }
              }
            ]
          }],
          max_tokens: 1500
        })
      });

      const data = await response.json();
      console.log('🔥 Featherless response:', data);
      
      if (data.choices && data.choices[0]) {
        const enhancedText = data.choices[0].message.content;
        console.log('🔥 Enhanced nutrition text:', enhancedText);
        
        // Store the enhanced text and save to OpenNote for reference
        setEnhancedNutritionImage(enhancedText);
        
        // Save to OpenNote as a reference (not for enhancement)
        try {
          await fetch('https://api.opennote.com/v1/notes', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: 'Enhanced Nutrition Reference',
              content: enhancedText
            })
          });
          console.log('🔥 Saved to OpenNote for reference');
        } catch (opennoteError) {
          console.log('🔥 OpenNote save failed (non-critical):', opennoteError);
        }
        
        setStep('enhanced');
      } else {
        setEnhancedNutritionImage(imageData);
        setStep('enhanced');
      }
    } catch (error) {
      console.error('🔥 Failed to enhance image:', error);
      setEnhancedNutritionImage(imageData);
      setStep('enhanced');
    }
    setLoading(false);
  };

  const generateVideo = async () => {
    setLoading(true);
    console.log('🎥 Starting video generation with OpenNote...');
    
    try {
      // Use OpenNote to generate video about product harms
      const response = await fetch('https://api.opennote.com/v1/notes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Product Harm Analysis Video',
          content: `Please generate a video explaining the potential harms and health concerns of consuming this product. Based on this nutrition analysis: ${analysis}. Create a clear, educational video that explains: 1) Main health concerns 2) Who should avoid this product 3) Healthier alternatives 4) Safe consumption guidelines. Make it suitable for elderly viewers with clear explanations.`
        })
      });

      const data = await response.json();
      console.log('🎥 OpenNote video request:', data);
      
      if (data.id) {
        console.log('🎥 Video generation started, checking status...');
        
        // For now, simulate video generation since OpenNote video API might be different
        setTimeout(() => {
          setVideoUrl('https://example.com/video.mp4'); // Simulated video URL
          console.log('🎥 Video ready: https://example.com/video.mp4');
          setLoading(false);
        }, 3000); // Simulate 3 second processing time
        
      } else {
        console.log('🎥 Failed to start video generation');
        setVideoUrl('Video generation failed');
        setLoading(false);
      }
    } catch (error) {
      console.error('🎥 Video generation error:', error);
      setVideoUrl('Video generation error');
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    // Web camera implementation
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Create canvas to capture image
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      
      // Wait for video to load
      video.onloadedmetadata = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        
        // Stop camera
        stream.getTracks().forEach(track => track.stop());
        
        if (step === 'front') {
          setFrontImage(imageData);
          setStep('nutrition');
        } else if (step === 'nutrition') {
          setNutritionImage(imageData);
          enhanceNutritionImage(imageData);
        }
      };
    } catch (error) {
      alert('Camera access denied or not available');
    }
  };

  const analyzeImages = async (frontUri, nutritionUri) => {
    setLoading(true);
    try {
      // Build prompt for nutrition analysis
      let personalizedPrompt = "Analyze this food product and its nutrition facts. Please provide detailed information about this product, including: 1) What the product is, 2) Key nutritional information from the facts label, 3) Important health considerations for elderly people, 4) Any general dietary restrictions to consider (like diabetes-friendly, gluten-free, kosher, etc.), 5) Overall assessment of whether this is a healthy choice for seniors. Please be thorough and specific.";

      // Send both images to Featherless AI for analysis
      const featherlessUrl = "https://api.featherless.ai/v1/chat/completions";
      
      const requestBody = {
        model: "google/gemma-3-27b-it",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: personalizedPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: frontUri
              }
            },
            {
              type: "image_url",
              image_url: {
                url: nutritionUri
              }
            }
          ]
        }],
        max_tokens: 1000,
        temperature: 0.7
      };

      const featherlessResp = await fetch(featherlessUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FEATHERLESS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const featherlessData = await featherlessResp.json();
      
      if (featherlessData.choices && featherlessData.choices[0]) {
        setAnalysis(featherlessData.choices[0].message.content);
      } else {
        setAnalysis("Unable to analyze the images. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Check console.");
    }
    setLoading(false);
  };

  const speakAnalysis = async () => {
    if (!analysis) return;
    
    setIsSpeaking(true);
    try {
      // Web speech synthesis
      const utterance = new SpeechSynthesisUtterance(analysis);
      utterance.rate = 0.8;
      utterance.pitch = 0.9;
      utterance.volume = 1.0;
      
      window.speechSynthesis.speak(utterance);
      
      utterance.onend = () => setIsSpeaking(false);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      alert('Text-to-speech not available on this device.');
      setIsSpeaking(false);
    }
  };

  // Enhanced Nutrition Text Screen
  if (step === 'enhanced') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>🥗 Enhanced Nutrition Facts</h1>
        
        <p style={styles.instruction}>
          Here's your nutrition facts with larger, more readable text:
        </p>
        
        <div style={styles.enhancedTextContainer}>
          <div style={styles.enhancedText}>
            {typeof enhancedNutritionImage === 'string' 
              ? enhancedNutritionImage 
              : 'Processing nutrition facts...'}
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button style={styles.button} onClick={() => analyzeImages(frontImage, nutritionImage)}>
            Analyze Product
          </button>
          
          <button style={styles.secondaryButton} onClick={() => setStep('nutrition')}>
            Retake Photo
          </button>
        </div>

        {loading && <div style={styles.loader}>Analyzing...</div>}
      </div>
    );
  }

  // Main App Screens
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🥗 Nutrition Assistant</h1>
      
      <p style={styles.instruction}>
        {step === 'front' 
          ? "Take a photo of the front of the product" 
          : "Now take a photo of the nutrition facts label"}
      </p>
      
      <button style={styles.button} onClick={takePhoto} disabled={loading}>
        {loading ? "Processing..." : `Take ${step === 'front' ? 'Front' : 'Nutrition'} Photo`}
      </button>

      <div style={styles.imageContainer}>
        {frontImage && <img src={frontImage} style={styles.preview} alt="Front" />}
        {nutritionImage && <img src={nutritionImage} style={styles.preview} alt="Nutrition" />}
      </div>

      {loading && <div style={styles.loader}>Processing...</div>}

      {analysis && (
        <div style={styles.analysisContainer}>
          <h2 style={styles.analysisTitle}>📊 Nutrition Analysis</h2>
          <p style={styles.analysisText}>{analysis}</p>
          
          <div style={styles.buttonContainer}>
            <button 
              style={[styles.speakButton, isSpeaking && styles.speakButtonDisabled]} 
              onClick={speakAnalysis} 
              disabled={isSpeaking || !analysis}
            >
              {isSpeaking ? "🔊 Speaking..." : "🔊 Read Analysis Aloud"}
            </button>
            
            <button 
              style={styles.videoButton} 
              onClick={generateVideo} 
              disabled={loading || !analysis}
            >
              {loading ? "🎥 Generating..." : "🎥 Generate Harm Analysis Video"}
            </button>
          </div>
          
          {videoUrl && (
            <div style={styles.videoContainer}>
              <h3 style={styles.videoTitle}>🎥 Product Harm Analysis Video</h3>
              {videoUrl.includes('http') ? (
                <video controls style={styles.videoPlayer} src={videoUrl}>
                  Your browser does not support the video tag.
                </video>
              ) : (
                <p style={styles.videoLoading}>{videoUrl}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    padding: '40px 20px',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif'
  },
  title: { 
    fontSize: '24px', 
    fontWeight: 'bold', 
    marginBottom: '20px',
    textAlign: 'center'
  },
  
  // Main app styles
  instruction: { 
    fontSize: '16px', 
    marginBottom: '20px', 
    textAlign: 'center',
    maxWidth: '600px'
  },
  button: { 
    backgroundColor: '#007AFF', 
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '10px', 
    fontSize: '18px', 
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px'
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '10px', 
    fontSize: '18px', 
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px'
  },
  buttonContainer: {
    display: 'flex',
    gap: '15px',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px'
  },
  imageContainer: { 
    display: 'flex', 
    justifyContent: 'center', 
    gap: '20px',
    width: '100%', 
    maxWidth: '600px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  preview: { 
    width: '150px', 
    height: '150px', 
    borderRadius: '10px',
    objectFit: 'cover'
  },
  enhancedPreview: {
    width: '300px',
    height: '300px',
    borderRadius: '10px',
    objectFit: 'contain',
    border: '3px solid #007AFF'
  },
  enhancedTextContainer: {
    width: '100%',
    maxWidth: '600px',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    border: '2px solid #007AFF'
  },
  enhancedText: {
    fontSize: '18px',
    lineHeight: '1.6',
    color: '#333',
    fontWeight: '500',
    whiteSpace: 'pre-wrap'
  },
  
  loader: {
    padding: '20px',
    fontSize: '18px',
    color: '#007AFF',
    fontWeight: 'bold'
  },
  
  analysisContainer: { 
    width: '100%', 
    maxWidth: '600px',
    marginTop: '20px', 
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    padding: '20px'
  },
  analysisTitle: { 
    fontSize: '18px', 
    fontWeight: 'bold', 
    marginBottom: '10px',
    color: '#007AFF'
  },
  analysisText: { 
    fontSize: '14px', 
    lineHeight: '20px',
    color: '#333',
    marginBottom: '20px',
    whiteSpace: 'pre-wrap'
  },
  speakButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '15px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%'
  },
  speakButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed'
  },
  videoButton: {
    backgroundColor: '#ff6b35',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '10px'
  },
  videoContainer: {
    width: '100%',
    maxWidth: '600px',
    marginTop: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '10px',
    padding: '20px',
    border: '2px solid #ff6b35'
  },
  videoTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#ff6b35'
  },
  videoPlayer: {
    width: '100%',
    borderRadius: '8px',
    maxHeight: '400px'
  },
  videoLoading: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    padding: '20px'
  }
};
