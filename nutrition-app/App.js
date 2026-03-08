import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// --- CONFIGURATION ---
const OPENNOTE_API_KEY = "bddc9497-b6a5-4d01-b233-1267501e3c0b";
const FEATHERLESS_API_KEY = "rc_27fa8f675f2a034e4aa6091a3099623bacd98ad18608e1f22c307869fcae077a";

// Dietary restriction options
const DIETARY_OPTIONS = [
  { id: 'diabetes', label: 'Diabetes', emoji: '🩺' },
  { id: 'kosher', label: 'Kosher', emoji: '🕍' },
  { id: 'halal', label: 'Halal (Muslim)', emoji: '☪️' },
  { id: 'gluten-free', label: 'Gluten-Free', emoji: '🌾' },
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱' },
  { id: 'low-sodium', label: 'Low Sodium', emoji: '🧂' },
  { id: 'heart-healthy', label: 'Heart Healthy', emoji: '❤️' },
  { id: 'kidney-friendly', label: 'Kidney Friendly', emoji: '🫘' },
  { id: 'lactose-intolerant', label: 'Lactose Intolerant', emoji: '🥛' }
]; 

export default function App() {
  const [frontImage, setFrontImage] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('quiz'); // quiz, front, nutrition, results
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedRestrictions, setSelectedRestrictions] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  const loadUserProfile = async () => {
    try {
      // Try to load existing profile from OpenNote (minimal API call)
      const response = await fetch('https://api.opennote.com/v1/journals', {
        headers: {
          'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Look for existing nutrition profile
        const nutritionJournal = data.journals?.find(j => j.title === 'Nutrition Profile');
        if (nutritionJournal) {
          // Load the profile note
          const notesResponse = await fetch(`https://api.opennote.com/v1/journals/${nutritionJournal.id}/notes`, {
            headers: {
              'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (notesResponse.ok) {
            const notesData = await notesResponse.json();
            const profileNote = notesData.notes?.find(n => n.title === 'User Dietary Profile');
            if (profileNote) {
              const profile = JSON.parse(profileNote.content);
              setUserProfile(profile);
              setSelectedRestrictions(profile.restrictions || []);
              setStep('front'); // Skip quiz if profile exists
            }
          }
        }
      }
    } catch (error) {
      console.log('No existing profile found, starting fresh');
    }
  };

  const saveUserProfile = async (restrictions) => {
    try {
      const profile = {
        restrictions,
        createdAt: new Date().toISOString(),
        version: '1.0'
      };
      
      // Create or update journal
      let journalId;
      const journalsResponse = await fetch('https://api.opennote.com/v1/journals', {
        headers: {
          'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (journalsResponse.ok) {
        const journalsData = await journalsResponse.json();
        const existingJournal = journalsData.journals?.find(j => j.title === 'Nutrition Profile');
        journalId = existingJournal?.id;
      }
      
      if (!journalId) {
        // Create new journal
        const createJournalResponse = await fetch('https://api.opennote.com/v1/journals', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Nutrition Profile',
            description: 'User dietary restrictions and preferences for nutrition analysis'
          })
        });
        
        if (createJournalResponse.ok) {
          const newJournal = await createJournalResponse.json();
          journalId = newJournal.id;
        }
      }
      
      if (journalId) {
        // Save profile note
        await fetch(`https://api.opennote.com/v1/journals/${journalId}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENNOTE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'User Dietary Profile',
            content: JSON.stringify(profile)
          })
        });
      }
      
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to save profile:', error);
      // Continue anyway - app will work without saving
    }
  };

  const toggleRestriction = (restrictionId) => {
    setSelectedRestrictions(prev => {
      const updated = prev.includes(restrictionId)
        ? prev.filter(id => id !== restrictionId)
        : [...prev, restrictionId];
      return updated;
    });
  };

  const skipQuiz = () => {
    setStep('front');
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) return alert("Camera access denied!");

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      
      if (step === 'front') {
        setFrontImage(uri);
        setStep('nutrition');
      } else {
        setNutritionImage(uri);
        analyzeImages(frontImage, uri);
      }
    }
  };

  const analyzeImages = async (frontUri, nutritionUri) => {
    setLoading(true);
    try {
      // Convert images to base64 for Featherless AI
      const encodeImageToBase64 = async (uri) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      const frontBase64 = await encodeImageToBase64(frontUri);
      const nutritionBase64 = await encodeImageToBase64(nutritionUri);

      // Build personalized prompt based on user restrictions
      let personalizedPrompt = "Analyze this food product and its nutrition facts. Please provide detailed information about this product, including: 1) What the product is, 2) Key nutritional information from the facts label, 3) Important health considerations for elderly people";
      
      if (selectedRestrictions.length > 0) {
        const restrictionLabels = selectedRestrictions
          .map(id => DIETARY_OPTIONS.find(opt => opt.id === id)?.label)
          .filter(Boolean)
          .join(', ');
        
        personalizedPrompt += `, 4) Specific analysis for these dietary restrictions: ${restrictionLabels}. Please clearly state if this product is suitable or not for each restriction and explain why`;
      } else {
        personalizedPrompt += ", 4) Any general dietary restrictions to consider (like diabetes-friendly, gluten-free, kosher, etc.)";
      }
      
      personalizedPrompt += ", 5) Overall assessment of whether this is a healthy choice for seniors. Please be thorough and specific.";

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
                url: frontBase64
              }
            },
            {
              type: "image_url",
              image_url: {
                url: nutritionBase64
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
      // Use more natural voice settings
      await Speech.speak(analysis, {
        language: 'en-US',
        voice: 'com.apple.ttsbundle.Samantha-compact', // More natural voice on iOS
        pitch: 0.9, // Slightly lower pitch for more natural sound
        rate: 0.7, // Slower rate for clarity
        volume: 1.0,
      });
    } catch (error) {
      console.error('Text-to-speech error:', error);
      // Fallback to default voice if specific voice fails
      try {
        await Speech.speak(analysis, {
          language: 'en-US',
          pitch: 0.9,
          rate: 0.7,
          volume: 1.0,
        });
      } catch (fallbackError) {
        alert('Text-to-speech not available on this device.');
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  // Quiz Screen
  if (step === 'quiz') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🥗 Welcome to Nutrition Assistant</Text>
        
        <Text style={styles.quizIntro}>
          Let's personalize your nutrition analysis. Select any dietary restrictions or health conditions that apply to you:
        </Text>
        
        <ScrollView style={styles.optionsContainer}>
          {DIETARY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                selectedRestrictions.includes(option.id) && styles.optionCardSelected
              ]}
              onPress={() => toggleRestriction(option.id)}
            >
              <Text style={styles.optionEmoji}>{option.emoji}</Text>
              <Text style={styles.optionLabel}>{option.label}</Text>
              {selectedRestrictions.includes(option.id) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.quizButtons}>
          <TouchableOpacity style={styles.skipButton} onPress={skipQuiz}>
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.continueButton} onPress={() => saveUserProfile(selectedRestrictions)}>
            <Text style={styles.continueButtonText}>
              {selectedRestrictions.length > 0 
                ? `Continue (${selectedRestrictions.length} selected)` 
                : 'Continue Without Restrictions'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main App Screens
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🥗 Nutrition Assistant</Text>
      
      <Text style={styles.instruction}>
        {step === 'front' 
          ? "Take a photo of the front of the product" 
          : "Now take a photo of the nutrition facts label"}
      </Text>
      
      {userProfile && userProfile.restrictions.length > 0 && (
        <View style={styles.restrictionsBadge}>
          <Text style={styles.restrictionsText}>
            🎯 Personalized for: {userProfile.restrictions.length} restrictions
          </Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.button} onPress={takePhoto} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? "Analyzing..." : `Take ${step === 'front' ? 'Front' : 'Nutrition'} Photo`}
        </Text>
      </TouchableOpacity>

      <View style={styles.imageContainer}>
        {frontImage && <Image source={{ uri: frontImage }} style={styles.preview} />}
        {nutritionImage && <Image source={{ uri: nutritionImage }} style={styles.preview} />}
      </View>

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 20}} />}

      {analysis && (
        <ScrollView style={styles.analysisContainer}>
          <Text style={styles.analysisTitle}>📊 Personalized Nutrition Analysis</Text>
          <Text style={styles.analysisText}>{analysis}</Text>
          
          <TouchableOpacity 
            style={[styles.speakButton, isSpeaking && styles.speakButtonDisabled]} 
            onPress={speakAnalysis} 
            disabled={isSpeaking || !analysis}
          >
            <Text style={styles.speakButtonText}>
              {isSpeaking ? "🔊 Speaking..." : "🔊 Read Analysis Aloud"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  
  // Quiz styles
  quizIntro: { 
    fontSize: 16, 
    marginBottom: 20, 
    textAlign: 'center', 
    paddingHorizontal: 20,
    lineHeight: 22
  },
  optionsContainer: { 
    width: '100%', 
    paddingHorizontal: 20,
    maxHeight: 400
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  optionCardSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF'
  },
  optionEmoji: { fontSize: 24, marginRight: 15 },
  optionLabel: { fontSize: 16, fontWeight: '500', flex: 1 },
  checkmark: { fontSize: 20, color: '#007AFF', fontWeight: 'bold' },
  quizButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  skipButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  
  // Main app styles
  instruction: { fontSize: 16, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, width: '80%', alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  imageContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
  preview: { width: 150, height: 150, borderRadius: 10, marginHorizontal: 10 },
  
  restrictionsBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15
  },
  restrictionsText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500'
  },
  
  analysisContainer: { 
    width: '100%', 
    marginTop: 20, 
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15
  },
  analysisTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 10,
    color: '#007AFF'
  },
  analysisText: { 
    fontSize: 14, 
    lineHeight: 20,
    color: '#333',
    marginBottom: 20
  },
  speakButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  speakButtonDisabled: {
    backgroundColor: '#6c757d'
  },
  speakButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});
