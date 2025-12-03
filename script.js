class SpeechRecognitionSystem {
    constructor() {
        this.isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        this.isRecording = false;
        this.transcript = '';
        this.uploadedAudio = null;

        // Add English language feedback messages
        this.messages = {
            START_PROMPT: 'Click "Start Recording" to begin',
            RECORDING: 'Recording in progress... Speak clearly',
            STOPPED: 'Recording stopped. Your transcript is ready.',
            ERROR_START: 'Error starting recognition. Please try again.',
            BROWSER_ERROR: 'Speech recognition is not supported in this browser. Please use Chrome or Edge.',
            NO_SPEECH: 'No speech detected. Please try again.',
            NETWORK_ERROR: 'Network error. Please check your internet connection.',
            PERMISSION_ERROR: 'Microphone permission denied. Please allow microphone access.',
            PROCESSING_AUDIO: 'Processing audio file...',
            AUDIO_PROCESSED: 'Audio file processed successfully.',
            AUDIO_ERROR: 'Error processing audio file. Please try another file.'
        };
        
        // Add language mapping for better translation
        this.languageMapping = {
            'en-US': 'en',
            'hi-IN': 'hi',
            'te-IN': 'te',
            'ta-IN': 'ta',
            'kn-IN': 'kn',
            'ml-IN': 'ml',
            'mr-IN': 'mr',
            'bn-IN': 'bn',
            'gu-IN': 'gu'
        };

        // Initialize elements early so we can show status
        this.initializeElements();
        
        // Speech synthesis and speak button
        this.speechSynthesis = window.speechSynthesis;
        this.speakButton = document.getElementById('speakButton');
        this.lastTranslation = '';
        this.speakButton.addEventListener('click', () => this.speakTranslation());
        
        // Initialize translation language dropdown
        this.translationLanguage = document.getElementById('translationLanguage');
        this.speakButton.textContent = `🔊 Speak ${this.translationLanguage.options[this.translationLanguage.selectedIndex].text}`;
        
        // Initialize recognition only if supported
        if (this.isSupported) {
            this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            this.setupRecognition();
        } else {
            this.statusElement.textContent = this.messages.BROWSER_ERROR;
            this.startButton.disabled = true;
            this.stopButton.disabled = true;
        }
        
        // Set up other event listeners
        this.setupEventListeners();
    }

    setupRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        
        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    // Translate final transcript to English
                    const translatedText = await this.translateToEnglish(transcript);
                    finalTranscript += translatedText;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.updateTranscript(finalTranscript, interimTranscript);
        };

        this.recognition.onnomatch = () => {
            this.statusElement.textContent = this.messages.NO_SPEECH;
        };

        this.recognition.onerror = (event) => {
            let errorMessage = this.messages.ERROR_START;
            if (event.error === 'network') {
                errorMessage = this.messages.NETWORK_ERROR;
            } else if (event.error === 'not-allowed') {
                errorMessage = this.messages.PERMISSION_ERROR;
            }
            this.statusElement.textContent = errorMessage;
            this.stopRecording();
        };
    }

    initializeElements() {
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.languageSelect = document.getElementById('languageSelect');
        this.translationLanguage = document.getElementById('translationLanguage');
        this.statusElement = document.getElementById('status');
        this.transcriptElement = document.getElementById('transcript');
        
        // File upload elements
        this.audioFileInput = document.getElementById('audioFileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.processAudioButton = document.getElementById('processAudioButton');
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.languageSelect.addEventListener('change', () => {
            if (this.isSupported) {
                this.recognition.lang = this.languageSelect.value;
            }
        });
        this.translationLanguage.addEventListener('change', () => {
            // When translation language changes, update the UI to reflect it
            this.speakButton.textContent = `🔊 Speak ${this.translationLanguage.options[this.translationLanguage.selectedIndex].text}`;
        });
        
        // File upload event listeners
        this.audioFileInput.addEventListener('change', (event) => this.handleFileSelect(event));
        this.processAudioButton.addEventListener('click', () => this.processAudioFile());
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            if (file.type.startsWith('audio/')) {
                this.uploadedAudio = file;
                this.fileInfo.textContent = `Selected: ${file.name}`;
                this.processAudioButton.disabled = false;
            } else {
                this.fileInfo.textContent = 'Please select an audio file';
                this.processAudioButton.disabled = true;
                this.uploadedAudio = null;
            }
        } else {
            this.fileInfo.textContent = 'No file selected';
            this.processAudioButton.disabled = true;
            this.uploadedAudio = null;
        }
    }
    
    processAudioFile() {
        if (!this.uploadedAudio) {
            return;
        }
        
        this.statusElement.textContent = this.messages.PROCESSING_AUDIO;
        
        // Create an audio context
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                // Decode the audio data
                const audioData = await audioContext.decodeAudioData(event.target.result);
                
                // Use Web Speech API for recognition (simplified for browser compatibility)
                // In a real app, you might use a server-side API for more accurate transcription
                const transcript = await this.simulateAudioTranscription(this.uploadedAudio.name);
                
                // Translate the transcript
                const translatedText = await this.translateToEnglish(transcript);
                
                // Update the UI
                this.updateTranscript(translatedText, transcript);
                this.statusElement.textContent = this.messages.AUDIO_PROCESSED;
                
            } catch (error) {
                console.error('Error processing audio:', error);
                this.statusElement.textContent = this.messages.AUDIO_ERROR;
            }
        };
        
        reader.onerror = () => {
            this.statusElement.textContent = this.messages.AUDIO_ERROR;
        };
        
        // Read the file as an array buffer
        reader.readAsArrayBuffer(this.uploadedAudio);
    }
    
    // Simulate audio transcription (in a real app, you'd use a proper API)
    async simulateAudioTranscription(filename) {
        // This is a simulation - in a real app, you'd use a proper speech-to-text API
        // For demo purposes, we'll return some sample text based on the filename
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time
        
        const sampleTexts = {
            'hi': 'नमस्ते, यह एक ऑडियो फ़ाइल है जिसे अपलोड किया गया है।',
            'te': 'హలో, ఇది అప్లోడ్ చేయబడిన ఆడియో ఫైల్.',
            'ta': 'வணக்கம், இது பதிவேற்றப்பட்ட ஒலிக் கோப்பு.',
            'kn': 'ಹಲೋ, ಇದು ಅಪ್ಲೋಡ್ ಮಾಡಲಾದ ಆಡಿಯೋ ಫೈಲ್.',
            'ml': 'ഹലോ, ഇത് അപ്‌ലോഡ് ചെയ്ത ഓഡിയോ ഫയലാണ്.',
            'mr': 'नमस्कार, हे अपलोड केलेले ऑडिओ फाइल आहे.',
            'bn': 'হ্যালো, এটি একটি আপলোড করা অডিও ফাইল।',
            'gu': 'હેલો, આ અપલોડ કરેલી ઓડિયો ફાઇલ છે.',
            'default': 'Hello, this is an uploaded audio file that needs to be transcribed and translated.'
        };
        
        // Try to match the filename with a language
        const detectedLang = Object.keys(this.languageMapping).find(key => 
            filename.toLowerCase().includes(this.languageMapping[key])
        );
        
        const sourceLang = detectedLang ? this.languageMapping[detectedLang] : 'default';
        return sampleTexts[sourceLang] || sampleTexts['default'];
    }

    startRecording() {
        if (!this.isSupported) {
            this.statusElement.textContent = this.messages.BROWSER_ERROR;
            return;
        }
        try {
            this.recognition.lang = this.languageSelect.value;
            this.recognition.start();
            this.isRecording = true;
            
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.statusElement.textContent = this.messages.RECORDING;
            this.statusElement.classList.add('recording');
        } catch (error) {
            console.error('Error starting recognition:', error);
            this.statusElement.textContent = this.messages.ERROR_START;
        }
    }

    stopRecording() {
        if (!this.isSupported) {
            return;
        }
        try {
            this.recognition.stop();
            this.isRecording = false;
            
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
            this.statusElement.textContent = this.messages.STOPPED;
            this.statusElement.classList.remove('recording');
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }

    updateTranscript(finalTranscript, interimTranscript) {
        if (finalTranscript) {
            this.lastTranslation = finalTranscript;
            const targetLangName = this.translationLanguage.options[this.translationLanguage.selectedIndex].text;
            this.transcript += `Original: ${interimTranscript}\n${targetLangName} Translation: ${finalTranscript}\n\n`;
            this.speakButton.disabled = false;
        }
        this.transcriptElement.textContent = this.transcript + 
            (interimTranscript ? `Speaking: ${interimTranscript}` : '');
    }

    speakTranslation() {
        if (this.lastTranslation && !this.speechSynthesis.speaking) {
            const utterance = new SpeechSynthesisUtterance(this.lastTranslation);
            utterance.lang = this.translationLanguage.value === 'en' ? 'en-US' : this.translationLanguage.value;
            utterance.rate = 0.9;
            utterance.pitch = 1;
            this.speechSynthesis.speak(utterance);
        }
    }

    async translateToEnglish(text) {
        try {
            const sourceLang = this.languageMapping[this.languageSelect.value] || 'auto';
            const targetLang = this.translationLanguage.value;
            
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
            );
            const data = await response.json();
            
            if (data.responseStatus === 200) {
                return data.responseData.translatedText;
            }
            return text;
        } catch (error) {
            console.error('Translation error:', error);
            return text;
        }
    }
}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpeechRecognitionSystem();
});