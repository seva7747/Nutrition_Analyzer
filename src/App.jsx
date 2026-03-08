import { useRef, useState } from 'react';
import './App.css';
// import { OpennoteClient } from 'opennote';
const FEATHERLESS_API_KEY = "rc_27fa8f675f2a034e4aa6091a3099623bacd98ad18608e1f22c307869fcae077a";
const OPENNOTE_API_KEY = "bddc9497-b6a5-4d01-b233-1267501e3c0b";


export default function App() {
  const [nutritionImage, setNutritionImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [basicFacts, setBasicFacts] = useState(null);
  const [importantWarnings, setImportantWarnings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [highlightedAreas, setHighlightedAreas] = useState([]);
  const [activeTab, setActiveTab] = useState('dangers');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Check if user is on mobile
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
  };

  // Quiz states
  const [step, setStep] = useState('quiz'); // quiz, photo, analysis
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userRestrictions, setUserRestrictions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});

  // Quiz questions
  const quizQuestions = [
    {
      id: 'health',
      question: 'Do you have any health conditions that require special dietary restrictions?',
      options: [
        { value: 'diabetes', label: 'Diabetes (watch sugar/carbs)' },
        { value: 'heart', label: 'Heart conditions (watch sodium/fat)' },
        { value: 'blood_pressure', label: 'High blood pressure (low sodium)' },
        { value: 'cholesterol', label: 'High cholesterol (low saturated fat)' },
        { value: 'none', label: 'No health restrictions' }
      ],
      multiple: true
    },
    {
      id: 'allergies',
      question: 'What food allergies do you have? (Select all that apply)',
      options: [
        { value: 'nuts', label: 'Nuts (tree nuts, peanuts)' },
        { value: 'dairy', label: 'Dairy (milk, cheese, lactose)' },
        { value: 'gluten', label: 'Gluten (wheat, barley)' },
        { value: 'soy', label: 'Soy products' },
        { value: 'eggs', label: 'Eggs' },
        { value: 'shellfish', label: 'Shellfish' },
        { value: 'none', label: 'No food allergies' }
      ],
      multiple: true
    },
    {
      id: 'religious',
      question: 'Do you follow any religious dietary restrictions?',
      options: [
        { value: 'kosher', label: 'Kosher (Jewish dietary laws)' },
        { value: 'halal', label: 'Halal (Islamic dietary laws)' },
        { value: 'vegetarian', label: 'Vegetarian (no meat/fish)' },
        { value: 'vegan', label: 'Vegan (no animal products)' },
        { value: 'hindu', label: 'Hindu (no beef/pork)' },
        { value: 'none', label: 'No religious restrictions' }
      ],
      multiple: true
    },
    {
      id: 'preferences',
      question: 'Any additional dietary preferences?',
      options: [
        { value: 'low_sugar', label: 'Low sugar' },
        { value: 'low_salt', label: 'Low salt/sodium' },
        { value: 'low_fat', label: 'Low fat' },
        { value: 'high_fiber', label: 'High fiber' },
        { value: 'organic', label: 'Prefer organic' },
        { value: 'none', label: 'No specific preferences' }
      ],
      multiple: true
    }
  ];

  // Quiz handler functions
  const handleQuizAnswer = (questionId, selectedOptions) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: selectedOptions
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      finishQuiz();
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const finishQuiz = () => {
    console.log("🎯 Finishing quiz...");
    console.log("📝 Quiz answers:", quizAnswers);
    
    // Collect all restrictions from quiz answers
    const allRestrictions = [];
    Object.values(quizAnswers).forEach(answerArray => {
      if (Array.isArray(answerArray)) {
        answerArray.forEach(answer => {
          if (answer !== 'none') {
            allRestrictions.push(answer);
          }
        });
      }
    });
    
    console.log("⚠️ Collected restrictions:", allRestrictions);
    setUserRestrictions(allRestrictions);
    console.log("📸 Setting step to 'photo'");
    setStep('photo');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size first
    const fileSizeMB = file.size / 1024 / 1024;
    console.log(`📸 Original file size: ${fileSizeMB.toFixed(2)}MB`);
    
    // Featherless AI typically handles up to 20MB for vision models
    if (fileSizeMB > 20) {
      alert(`File too large (${fileSizeMB.toFixed(2)}MB). Please take a photo smaller than 20MB.`);
      return;
    }

    try {
      console.log("📸 Processing image for mobile upload...");
      console.log(`📸 File details: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB, type: ${file.type}`);
      
      // Try compression first to handle base64 bloat
      let finalImageData = await compressImage(file, 800, 0.7); // Moderate compression
      let finalSize = finalImageData.length / 1024 / 1024;
      console.log(`📸 First compression: ${finalSize.toFixed(2)}MB`);
      
      // If still too large, compress more aggressively
      if (finalSize > 5) {
        console.log("📸 Compressing more aggressively...");
        finalImageData = await compressImage(file, 600, 0.5);
        finalSize = finalImageData.length / 1024 / 1024;
        console.log(`📸 Second compression: ${finalSize.toFixed(2)}MB`);
      }
      
      if (finalSize > 3) {
        console.log("📸 Ultra compression needed...");
        finalImageData = await compressImage(file, 400, 0.3);
        finalSize = finalImageData.length / 1024 / 1024;
        console.log(`📸 Ultra compression: ${finalSize.toFixed(2)}MB`);
      }
      
      console.log(`� Final image ready: ${finalSize.toFixed(2)}MB`);
      
      setNutritionImage(finalImageData);
      
      // Only analyze if not already analyzing
      if (!analyzing) {
        analyzeGroceryItem(finalImageData);
      }
      
    } catch (error) {
      console.error("💀 Image processing failed:", error);
      alert("Image processing failed. Please try a different photo.");
      return;
    }
  };

  const fileToBase64 = (dataUrl) => {
    // Extract base64 from data URL
    return dataUrl.split(',')[1];
  };

  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate new dimensions - moderate size
            let { width, height } = img;
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Fill with white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // Compress and draw
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get compressed base64
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            console.log(`📸 Compressed ${img.naturalWidth}x${img.naturalHeight} to ${width}x${height}, size: ${(compressedDataUrl.length * 0.75 / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedDataUrl);
          } catch (error) {
            console.error("💀 Canvas compression failed:", error);
            reject(error);
          }
        };
        img.onerror = () => {
          console.error("💀 Image loading failed");
          reject(new Error("Image loading failed"));
        };
        img.src = event.target.result;
      };
      reader.onerror = () => {
        console.error("💀 File reading failed");
        reject(new Error("File reading failed"));
      };
      reader.readAsDataURL(file);
    });
  };

  const analyzeGroceryItem = async (nutritionDataUrl) => {
    // Prevent multiple simultaneous requests
    if (analyzing) {
      console.log("⚠️ Analysis already in progress, skipping...");
      return;
    }

    setAnalyzing(true);
    setLoading(true);
    try {
      console.log("🧠 Analyzing grocery item nutrition facts with user restrictions...");
      
      if (!nutritionDataUrl) throw new Error("Failed to process image");

      // Check file size - Base64 bloat makes files much larger
      const base64Size = nutritionDataUrl.length / 1024 / 1024;
      const maxSizeMB = 8; // 8MB limit for base64 (accounts for bloat)
      
      if (base64Size > maxSizeMB) {
        console.log(`⚠️ Image too large: ${base64Size.toFixed(2)}MB`);
        alert(`Image too large (${base64Size.toFixed(2)}MB). Please take a smaller photo.`);
        return;
      }

      // Create personalized prompt based on user restrictions
      const restrictionsText = userRestrictions.length > 0 
        ? `IMPORTANT: The user has these dietary restrictions: ${userRestrictions.join(', ')}. Focus heavily on these restrictions in your analysis.`
        : 'The user has no specific dietary restrictions.';

      const mobileInstructions = isMobileDevice() 
        ? 'IMPORTANT: Keep all paragraphs very short (2-3 sentences maximum) for mobile readability. Use bullet points and break up long text into smaller chunks.'
        : '';

      const featherlessUrl = `https://api.featherless.ai/v1/chat/completions`;
      
      const requestBody = {
        model: "google/gemma-3-27b-it",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this nutrition facts image and provide only important health warnings for elderly users.

${restrictionsText}

${mobileInstructions}

IMPORTANT: Do NOT include basic nutrition facts, calories, or macronutrients. Focus ONLY on health warnings and concerns.

CRITICAL REQUIREMENTS:
- Your response must be 6 lines or less (sub-7 lines, no more than 6)
- Speak directly to the user using "you" and "your"
- Format as a single paragraph with line breaks
- Focus on the most important health concerns for elderly users
- Include the most critical warnings based on user's dietary restrictions
- Tell the user if they should avoid this product
- Keep it concise and actionable

HIGHLIGHTING REQUIREMENTS:
- After your health warnings, add a line starting with "HIGHLIGHTS:"
- List the problematic areas on the nutrition label (e.g., "sodium", "sugar", "saturated fat", "cholesterol")
- Only list the actual problematic nutrients for this specific user
- Format: HIGHLIGHTS: sodium, sugar, saturated fat

Example format:
"You should avoid this product due to high sodium that may affect your blood pressure. The sugar content is concerning if you have diabetes. Based on your dietary restrictions, this product may not be safe for you. Consider alternatives with lower sodium and sugar content. Always consult your doctor about specific dietary concerns.
HIGHLIGHTS: sodium, sugar"`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${fileToBase64(nutritionDataUrl)}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      };

      console.log("📤 Sending request to Featherless AI...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(featherlessUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FEATHERLESS_API_KEY}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log("✓ Got response from Featherless AI, status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ Featherless AI error response:", errorData);
        throw new Error(errorData?.error?.message || `Featherless AI error: ${response.status}`);
      }

      const data = await response.json();
      const fullAnalysis = data?.choices?.[0]?.message?.content?.trim() || "Unable to analyze product";
      console.log("✅ Analysis complete:", fullAnalysis);

      // Parse the response to get warnings and highlights
      const parts = fullAnalysis.split('HIGHLIGHTS:');
      const warningsText = parts[0]?.trim() || "No specific warnings identified";
      const highlightsText = parts[1]?.trim() || "";
      
      // Parse highlighted areas
      const highlightedItems = highlightsText.split(',').map(item => item.trim().toLowerCase()).filter(item => item);
      setHighlightedAreas(highlightedItems);
      console.log("🎯 Highlighted areas:", highlightedItems);

      // Don't modify the original image - just keep the highlights text
      console.log("� Problematic areas identified:", highlightedItems);

      setImportantWarnings(warningsText);
      setAnalysis(fullAnalysis); // Keep full analysis for reference
      setStep('analysis'); // Switch to analysis step to show results

    } catch (error) {
      console.error("💀 Error:", error);
      alert("Analysis Error: " + error.message);
      setAnalysis(null);
    } finally {
      setLoading(false);
      setAnalyzing(false); // Reset analyzing state
    }
  };

  const createHighlightedNutritionImage = async (originalImage, highlights) => {
    if (!highlights || highlights.length === 0) return originalImage;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Add red overlay for problematic areas
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        
        // Simulate highlighting common problematic areas
        // This is a simplified approach - in production, you'd use OCR to find exact positions
        const highlightAreas = {
          'sodium': { x: img.width * 0.6, y: img.height * 0.3, width: img.width * 0.35, height: img.height * 0.08 },
          'sugar': { x: img.width * 0.6, y: img.height * 0.4, width: img.width * 0.35, height: img.height * 0.08 },
          'fat': { x: img.width * 0.6, y: img.height * 0.5, width: img.width * 0.35, height: img.height * 0.08 },
          'cholesterol': { x: img.width * 0.6, y: img.height * 0.6, width: img.width * 0.35, height: img.height * 0.08 },
          'calories': { x: img.width * 0.6, y: img.height * 0.2, width: img.width * 0.35, height: img.height * 0.08 }
        };
        
        highlights.forEach(item => {
          const area = highlightAreas[item];
          if (area) {
            ctx.fillRect(area.x, area.y, area.width, area.height);
            ctx.strokeRect(area.x, area.y, area.width, area.height);
          }
        });
        
        // Add warning icons
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.font = 'bold 24px Arial';
        highlights.forEach((item, index) => {
          const area = highlightAreas[item];
          if (area) {
            ctx.fillText('⚠️', area.x - 30, area.y + 20);
          }
        });
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = originalImage;
    });
  };

  const resetAnalysis = () => {
    setNutritionImage(null);
    setAnalysis(null);
    setBasicFacts(null);
    setImportantWarnings(null);
    setHighlightedAreas([]);
    setSpeaking(false);
    setCurrentWordIndex(-1);
    setVideoUrl(null);
    setStep('photo');
  };

  const generateProductVideo = async () => {
    if (!basicFacts || !importantWarnings) return;

    setGenerating(true);
    try {
      console.log("🎬 Creating video request with OpenNote...");

      const videoPrompt = `Create a short educational video (30-60 seconds) explaining the health impacts of this product based on this analysis:\n\n${analysis}\n\nKey points to cover:\n1. Main health concerns for elderly\n2. Who should avoid this product\n3. Healthier alternatives\n4. Safe consumption tips\n\nCreate in simple, clear language suitable for elderly viewers.`;

      // Use OpenNote's text-to-video capability with enhanced features
      const response = await fetch('https://api.opennote.com/v1/videos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Product Nutrition Video',
          content: videoPrompt,
          model: 'picasso',
          voice: 'nova',
          duration: 90, // Longer video for better education
          watermark: false,
          include_sources: true,
          search_for: "nutrition health elderly safe products",
          source_count: 3,
          // Add visual style for elderly viewers
          style: {
            font_size: 'large',
            background_color: '#ffffff',
            text_color: '#000000',
            contrast: 'high'
          }
        })
      });

      const data = await response.json();
      console.log("📊 OpenNote response:", data);
      
      if (data.id) {
        
      } else {
        throw new Error("Failed to submit video request");
      }

    } catch (error) {
      console.error("❌ Error with OpenNote:", error);
      alert("Video request error: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const pollVideoCompletion = async (client, videoId, maxAttempts = 300) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await client.video.status(videoId);
        console.log(`📊 Status (attempt ${attempt + 1}):`, status);
        
        if (status.status === "completed" && status.response?.s3_url) {
          console.log("✅ Video ready!");
          setVideoUrl(status.response.s3_url);
          alert("✓ Video explanation is ready!");
          return;
        }

        if (status.status === "failed") {
          throw new Error(status.message || "Video generation failed");
        }

        // Wait 15 seconds before polling again (as shown in SDK docs)
        console.log(`Video generation in progress... ${status.progress || 0}% (${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (error) {
        console.error("Error polling video:", error);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error("Video generation timed out");
  };

  const speakWarnings = async () => {
    if (!importantWarnings || speaking) return;

    setSpeaking(true);
    setCurrentWordIndex(-1);

    try {
      console.log("� Using browser SpeechSynthesis for warnings");

      // Use Web Speech API
      const utterance = new SpeechSynthesisUtterance(importantWarnings);
      utterance.lang = 'en-US';
      utterance.rate = 1;
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          // find the word index based on char index
          const charIndex = event.charIndex;
          const words = importantWarnings.split(/\s+/);
          let cumulative = 0;
          for (let i = 0; i < words.length; i++) {
            cumulative += words[i].length + 1;
            if (charIndex < cumulative) {
              setCurrentWordIndex(i);
              break;
            }
          }
        }
      };
      utterance.onend = () => {
        setSpeaking(false);
        setCurrentWordIndex(-1);
      };

      speechSynthesis.speak(utterance);

    } catch (error) {
      console.error("💀 Speech error:", error);
      alert("Speech Error: " + error.message);
      setSpeaking(false);
      setCurrentWordIndex(-1);
    }
  };

  // Function to render warnings with highlighting
  const renderWarningsWithHighlighting = () => {
    if (!importantWarnings) return null;

    const words = importantWarnings.split(/\s+/);
    return words.map((word, index) => (
      <span
        key={index}
        className={index === currentWordIndex ? 'highlight-word' : ''}
      >
        {word}{' '}
      </span>
    ));
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📦 Grocery Item Analyzer</h1>
        <p className="subtitle">For Seniors: Get Important Nutrition Information</p>
      </div>

      {/* QUIZ SECTION */}
      {step === 'quiz' && (
        <div className="quiz-container">
          <div className="quiz-header">
            <h2 className="quiz-title">📋 Tell Us About Your Dietary Needs</h2>
            <p className="quiz-subtitle">Question {currentQuestion + 1} of {quizQuestions.length}</p>
          </div>
          
          <div className="quiz-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="quiz-question">
            <h3 className="question-text">{quizQuestions[currentQuestion].question}</h3>
            <div className="quiz-options">
              {quizQuestions[currentQuestion].options.map((option, index) => (
                <label 
                  key={option.value} 
                  className="quiz-option"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={quizAnswers[quizQuestions[currentQuestion].id]?.includes(option.value) || false}
                    onChange={(e) => {
                      const currentAnswers = quizAnswers[quizQuestions[currentQuestion].id] || [];
                      if (e.target.checked) {
                        handleQuizAnswer(quizQuestions[currentQuestion].id, [...currentAnswers, option.value]);
                      } else {
                        handleQuizAnswer(quizQuestions[currentQuestion].id, currentAnswers.filter(a => a !== option.value));
                      }
                    }}
                  />
                  <span className="option-label">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="quiz-buttons">
            <button 
              className="button secondary-btn" 
              onClick={previousQuestion}
              disabled={currentQuestion === 0}
            >
              ← Previous
            </button>
            <button 
              className="button primary-btn" 
              onClick={nextQuestion}
              disabled={!quizAnswers[quizQuestions[currentQuestion].id] || quizAnswers[quizQuestions[currentQuestion].id].length === 0}
            >
              {currentQuestion === quizQuestions.length - 1 ? 'Start Analysis →' : 'Next →'}
            </button>
          </div>
        </div>
      )}

      {/* SELECT NUTRITION PHOTO */}
      {step === 'photo' && !nutritionImage && (
        <>
          {console.log("📸 Rendering photo upload section, step:", step)}
          <div className="instruction-box">
            <p className="instruction-text">
              {isMobileDevice() ? 'Take or upload a photo of the Nutrition Facts label' : 'Upload a photo of the Nutrition Facts label'}
            </p>
            <p className="help-text">
              {isMobileDevice() 
                ? 'Take a clear photo of the nutrition information or choose from your photos' 
                : 'Take a clear photo of the nutrition information on the back of the product'
              }
            </p>
            
            {/* Mobile: Camera + Gallery options */}
            {isMobileDevice() ? (
              <div className="camera-options">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button className="button primary-btn" onClick={() => cameraInputRef.current?.click()}>
                  📸 Take Photo
                </button>
                <button className="button secondary-btn" onClick={() => fileInputRef.current?.click()}>
                  🖼️ Choose from Photos
                </button>
              </div>
            ) : (
              /* Computer: File upload only */
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button className="button primary-btn" onClick={() => fileInputRef.current?.click()}>
                  📂 Choose Nutrition Label Photo
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* SHOW NUTRITION IMAGE */}
      {step === 'photo' && nutritionImage && (
        <div className="image-container">
          <p className="image-label">✓ Nutrition Label Uploaded</p>
          <img src={nutritionImage} alt="Nutrition label" className="preview-img" />
        </div>
      )}

      {/* LOADING INDICATOR */}
      {loading && (
        <div className="loading-box">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing nutrition information...</p>
          <p className="loading-subtext">This usually takes 20-30 seconds</p>
        </div>
      )}

      {/* ANALYSIS RESULTS */}
      {step === 'analysis' && importantWarnings && (
        <div className="analysis-container">
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-btn ${activeTab === 'dangers' ? 'active' : ''}`}
              onClick={() => setActiveTab('dangers')}
            >
              ⚠️ Dangers
            </button>
            <button 
              className={`tab-btn ${activeTab === 'information' ? 'active' : ''}`}
              onClick={() => setActiveTab('information')}
            >
              ℹ️ Information
            </button>
            <button 
              className={`tab-btn ${activeTab === 'photo' ? 'active' : ''}`}
              onClick={() => setActiveTab('photo')}
            >
              📷 Photo
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* DANGERS TAB */}
            {activeTab === 'dangers' && (
              <div className="tab-panel">
                <div className="warnings-box">
                  <div className="warnings-header">
                    <h2 className="warnings-title">⚠️ Health Warnings:</h2>
                    <button className="audio-btn" onClick={speakWarnings} disabled={speaking}>
                      {speaking ? '🔊 Speaking...' : '🔊 Speak Warnings'}
                    </button>
                  </div>
                  <div className="warnings-text">
                    {renderWarningsWithHighlighting()}
                  </div>
                </div>
                
                {/* Problematic Areas Legend */}
                {highlightedAreas.length > 0 && (
                  <div className="highlight-legend">
                    <p className="legend-title">⚠️ Problematic Areas:</p>
                    <div className="legend-items">
                      {highlightedAreas.map((area, index) => (
                        <span key={index} className="legend-item">
                          🔴 {area.charAt(0).toUpperCase() + area.slice(1)}
                        </span>
                      ))}
                    </div>
                    <p className="legend-note">These nutrients may be harmful for your specific health conditions</p>
                  </div>
                )}
              </div>
            )}

            {/* INFORMATION TAB */}
            {activeTab === 'information' && (
              <div className="tab-panel">
                <div className="info-box">
                  <h2 className="info-title">📊 Product Information</h2>
                  <div className="info-content">
                    <p className="info-text">
                      <strong>Health Analysis Complete</strong><br/>
                      This product has been analyzed based on your specific dietary restrictions and health conditions.
                    </p>
                    <div className="info-details">
                      <p><strong>Your Restrictions:</strong> {userRestrictions.length > 0 ? userRestrictions.join(', ') : 'None specified'}</p>
                      <p><strong>Analysis Date:</strong> {new Date().toLocaleDateString()}</p>
                      <p><strong>Recommendation:</strong> {importantWarnings.includes('avoid') ? 'Consider alternatives' : 'Use in moderation'}</p>
                    </div>
                    <div className="audio-section">
                      <button className="audio-btn large" onClick={speakWarnings} disabled={speaking}>
                        {speaking ? '🔊 Speaking Analysis...' : '🔊 Speak Full Analysis'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PHOTO TAB */}
            {activeTab === 'photo' && nutritionImage && (
              <div className="tab-panel">
                <div className="photo-tab-container">
                  <p className="photo-instructions">📱 Swipe to navigate between tabs</p>
                  <div className="image-container">
                    <p className="image-label">✓ Nutrition Label Analyzed</p>
                    <img src={nutritionImage} alt="Nutrition label" className="preview-img" />
                  </div>
                  <p className="photo-note">This is the original nutrition label that was analyzed</p>
                </div>
              </div>
            )}
          </div>

          {/* Button Group - Show on all tabs */}
          <div className="button-group">
            <button className="button secondary-btn" onClick={resetAnalysis}>
              📷 Analyze Another Product
            </button>
            <button className="button video-btn" onClick={generateProductVideo} disabled={generating}>
              {generating ? '🎬 Generating Video...' : '🎬 Generate Video Explanation'}
            </button>
          </div>

          {/* Video Display */}
          {videoUrl && (
            <div className="video-box">
              <h3 className="video-title">🎥 Product Video Explanation</h3>
              <p className="video-description">{videoUrl}</p>
              {videoUrl.startsWith('http') && (
                <video className="product-video" controls>
                  <source src={videoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
