class SpeechRecognitionSystem {
    constructor() {
        this.isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        this.messages = {
            STARTED: 'Recording started...',
            RECORDING: 'Recording in progress... Speak clearly',
            STOPPED: 'Recording stopped. Your transcript is ready.',
            NO_SPEECH: 'No speech detected. Please try again.',
            ERROR_START: 'Could not start recording. Please check microphone permissions.',
            NETWORK_ERROR: 'Network error. Please check your connection.',
            PERMISSION_ERROR: 'Microphone access denied. Please allow permissions.',
            PROCESSING_AUDIO: 'Processing audio...',
            AUDIO_PROCESSED: 'Audio processed.',
            AUDIO_ERROR: 'Error processing audio.',
            BROWSER_ERROR: 'Speech recognition not supported. Try Chrome on HTTPS.'
        };
        this.transcript = '';
        this.fullOriginal = '';
        this.fullTranslation = '';
        this.lastTranslation = '';
        this.lastDisplayedOriginal = '';
        this.lastDisplayedTranslation = '';
        this.lastDisplayedKey = '';
        this.lastOriginalSeen = '';
        this.isRecording = false;
        this.isReverse = false;
        this.recognitionOverrideLocale = null;
        this._restartInProgress = false;
        this.autoStopOnSilence = true;
        this.silenceTimeoutMs = 6000;
        this.silenceThreshold = 0.04;
        this.lastVoiceTs = 0;
        this.mode = 'translation';
        this.languageMapping = {
            auto: 'auto',
            english: 'en',
            hindi: 'hi',
            marathi: 'mr',
            telugu: 'te',
            tamil: 'ta',
            kannada: 'kn',
            malayalam: 'ml',
            bengali: 'bn',
            gujarati: 'gu'
        };
        this.scriptMapping = {
            hi: 'devanagari',
            mr: 'devanagari',
            te: 'telugu',
            ta: 'tamil',
            kn: 'kannada',
            ml: 'malayalam',
            bn: 'bengali',
            gu: 'gujarati',
            en: 'latin'
        };
        this.initializeElements();
        this._translationErrorShown = false;
        if (this.isSupported) {
            this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            this.setupRecognition();
        }
        this.setupEventListeners();
        this.speechSynthesis = window.speechSynthesis;
        this.applySavedTheme();
        this.renderHistory();
    }

    transliterateToLatin(text, langCode) {
        try {
            if (!text || !langCode) return '';
            if (typeof Sanscript !== 'undefined') {
                const fromScript = this.scriptMapping ? this.scriptMapping[langCode] : undefined;
                if (fromScript) {
                    return Sanscript.t(text, fromScript, 'itrans');
                }
            }
            if (langCode === 'te') {
                return this.transliterateTeluguFallback(text);
            }
            return '';
        } catch (e) {
            console.warn('Transliteration error:', e);
            return '';
        }
    }

    // Cross-script transliteration: target language script -> speaker's language script
    transliterateToSpeakerScript(text, sourceLangCode, targetLangCode) {
        try {
            if (!text || !sourceLangCode || !targetLangCode) return '';
            const fromScript = this.scriptMapping ? this.scriptMapping[targetLangCode] : undefined;
            const toScript = this.scriptMapping ? this.scriptMapping[sourceLangCode] : undefined;

            // Prefer Sanscript when available
            if (typeof Sanscript !== 'undefined' && fromScript && toScript) {
                return Sanscript.t(text, fromScript, toScript);
            }
            // Use local transliterator if available
            if (typeof LocalTransliterator !== 'undefined') {
                const out = LocalTransliterator.tByLang(text, targetLangCode, sourceLangCode);
                if (out) return out;
            }
            // Fallback: Devanagari (hi) → Telugu (te)
            if (targetLangCode === 'hi' && sourceLangCode === 'te') {
                return this.devanagariToTelugu(text);
            }
            return '';
        } catch (e) {
            console.warn('Cross-script transliteration error:', e);
            return '';
        }
    }

    // Minimal fallback for Devanagari → Telugu script
    devanagariToTelugu(text) {
        const devVowels = {
            'अ': 'అ','आ': 'ఆ','इ': 'ఇ','ई': 'ఈ','उ': 'ఉ','ऊ': 'ఊ','ऋ': 'ఋ','ॠ': 'ౠ','ए': 'ఎ','ऐ': 'ఐ','ओ': 'ఒ','औ': 'ఔ'
        };
        const devMatras = {
            'ा': 'ా','ि': 'ి','ी': 'ీ','ु': 'ు','ू': 'ూ','ृ': 'ృ','ॄ': 'ౄ','े': 'ే','ै': 'ై','ो': 'ో','ौ': 'ౌ'
        };
        const devConsonants = {
            'क': 'క','ख': 'ఖ','ग': 'గ','घ': 'ఘ','ङ': 'ఙ',
            'च': 'చ','छ': 'ఛ','ज': 'జ','झ': 'ఝ','ञ': 'ఞ',
            'ट': 'ట','ठ': 'ఠ','ड': 'డ','ढ': 'ఢ','ण': 'ణ',
            'त': 'త','थ': 'థ','द': 'ద','ध': 'ధ','न': 'న',
            'प': 'ప','फ': 'ఫ','ब': 'బ','भ': 'భ','म': 'మ',
            'य': 'య','र': 'ర','ल': 'ల','व': 'వ','श': 'శ','ष': 'ష','स': 'స','ह': 'హ'
        };
        const viramaDev = '्';
        const anusvaraDev = 'ं';
        const visargaDev = 'ः';
        const chandrabinduDev = 'ँ';

        const anusvaraTe = 'ం';
        const visargaTe = 'ః';
        const chandrabinduTe = 'ఁ';
        const viramaTe = '్';

        let out = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i + 1];

            if (devVowels[ch]) {
                out += devVowels[ch];
                continue;
            }
            if (devConsonants[ch]) {
                const base = devConsonants[ch];
                if (next === viramaDev) {
                    out += base + viramaTe;
                    i += 1; // consume virama
                } else if (next && devMatras[next]) {
                    out += base + devMatras[next];
                    i += 1; // consume matra
                } else {
                    out += base; // inherent vowel
                }
                continue;
            }
            if (devMatras[ch]) {
                // Standalone matra: approximate with corresponding independent vowel
                // This case is rare; append the Telugu matra sign to a generic consonant placeholder is incorrect, so use vowel
                const reverseVowel = {
                    'ా': 'ఆ','ి': 'ఇ','ీ': 'ఈ','ు': 'ఉ','ూ': 'ఊ','ృ': 'ఋ','ౄ': 'ౠ','ే': 'ఏ','ై': 'ఐ','ో': 'ఓ','ౌ': 'ఔ'
                };
                out += reverseVowel[devMatras[ch]] || '';
                continue;
            }
            if (ch === anusvaraDev) { out += anusvaraTe; continue; }
            if (ch === visargaDev) { out += visargaTe; continue; }
            if (ch === chandrabinduDev) { out += chandrabinduTe; continue; }
            out += ch; // spaces/punctuation
        }
        return out;
    }

    transliterateTeluguFallback(text) {
        const vowels = {
            'అ': 'a','ఆ': 'aa','ఇ': 'i','ఈ': 'ii','ఉ': 'u','ఊ': 'uu','ఋ': 'r̥','ౠ': 'r̥̄','ఎ': 'e','ఏ': 'ee','ఐ': 'ai','ఒ': 'o','ఓ': 'oo','ఔ': 'au'
        };
        const vowelSigns = {
            'ా': 'aa','ి': 'i','ీ': 'ii','ు': 'u','ూ': 'uu','ృ': 'ru','ె': 'e','ే': 'ee','ై': 'ai','ొ': 'o','ో': 'oo','ౌ': 'au'
        };
        const consonants = {
            'క': 'k','ఖ': 'kh','గ': 'g','ఘ': 'gh','ఙ': 'ng',
            'చ': 'ch','ఛ': 'chh','జ': 'j','ఝ': 'jh','ఞ': 'ny',
            'ట': 't','ఠ': 'th','డ': 'd','ఢ': 'dh','ణ': 'n',
            'త': 't','థ': 'th','ద': 'd','ధ': 'dh','న': 'n',
            'ప': 'p','ఫ': 'ph','బ': 'b','భ': 'bh','మ': 'm',
            'య': 'y','ర': 'r','ల': 'l','వ': 'v','శ': 'sh','ష': 'sh','స': 's','హ': 'h',
            'ళ': 'l','క్ష': 'ksh','ఱ': 'r'
        };
        const specials = { 'ం': 'm', 'ః': 'h', 'ఁ': 'n' };
        const virama = '్';

        let out = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const next = text[i+1];
            if (vowels[ch]) {
                out += vowels[ch];
                continue;
            }
            if (consonants[ch]) {
                // Handle conjuncts like 'క్ష'
                if (ch === 'క' && next === '్ష') {
                    out += 'ksh';
                    i += 1;
                    continue;
                }
                let base = consonants[ch];
                // Check for vowel sign
                if (vowelSigns[next]) {
                    out += base.replace(/a$/,'') + vowelSigns[next];
                    i += 1;
                } else if (next === virama) {
                    out += base.replace(/a$/,'');
                    i += 1;
                } else {
                    out += base;
                }
                continue;
            }
            if (vowelSigns[ch]) {
                out += vowelSigns[ch];
                continue;
            }
            if (specials[ch]) {
                out += specials[ch];
                continue;
            }
            // Default: pass through spaces/punctuation
            out += ch;
        }
        return out;
    }

    setupRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = async (event) => {
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    const seg = String(transcript || '').trim();
                    if (seg) {
                        const oSpace = this.fullOriginal ? ' ' : '';
                        const tSpace = this.fullTranslation ? ' ' : '';
                        this.fullOriginal += oSpace + seg;
                        const translatedText = await this.translateToEnglish(seg);
                        this.fullTranslation += tSpace + (translatedText || '');
                        this.addHistory(seg, translatedText || '');
                        this.lastOriginalSeen = this.fullOriginal;
                    }
                } else {
                    interimTranscript += transcript;
                }
            }

            this.lastVoiceTs = Date.now();
            this.updateTranscript(this.fullOriginal, this.fullTranslation, interimTranscript);
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
            this.showToast(errorMessage, 'error');
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
        this.transcriptContainer = document.querySelector('.transcript-container');
        this.modeSelect = document.getElementById('modeSelect');
        this.reverseButton = document.getElementById('reverseButton');
        this.speakButton = document.getElementById('speakButton');
        this.toastElement = document.getElementById('toast');
        this.visualizerElement = document.getElementById('visualizer');
        this.historyList = document.getElementById('historyList');
        this.historyPanel = document.getElementById('historyPanel');
        this.historyToggle = document.getElementById('historyToggle');
        this.clearHistoryButton = document.getElementById('clearHistoryButton');
        this.stopSpeakButton = document.getElementById('stopSpeakButton');
        this.compileButton = document.getElementById('compileButton');
        this.compileModal = document.getElementById('compileModal');
        this.compileWordButton = document.getElementById('compileWord');
        this.compilePdfButton = document.getElementById('compilePdf');
        this.compileCancelButton = document.getElementById('compileCancel');
        this.historyPanel = document.getElementById('historyPanel');
        this.historyToggle = document.getElementById('historyToggle');
        
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
            if (this.mode === 'translation') {
                this.speakButton.textContent = `🔊 Speak ${this.translationLanguage.options[this.translationLanguage.selectedIndex].text}`;
            }
        });
        if (this.modeSelect) {
            this.modeSelect.addEventListener('change', () => {
                this.mode = this.modeSelect.value || 'translation';
                if (this.transcriptContainer) {
                    if (this.mode === 'lesson') {
                        this.transcriptContainer.classList.add('learn-mode');
                    } else {
                        this.transcriptContainer.classList.remove('learn-mode');
                    }
                }
                if (this.reverseButton) this.reverseButton.style.display = this.mode === 'lesson' ? 'none' : '';
                if (this.speakButton) {
                    if (this.mode === 'lesson') {
                        this.speakButton.textContent = '🔊 Speak Lesson';
                    } else {
                        this.speakButton.textContent = `🔊 Speak ${this.translationLanguage.options[this.translationLanguage.selectedIndex].text}`;
                    }
                }
            });
        }
        if (this.reverseButton) {
            this.reverseButton.addEventListener('click', () => {
                if (this.mode !== 'translation') { this.showToast('Reverse works in Translation Mode', 'info'); return; }
                this._restartInProgress = true;
                this.isReverse = true;
                this.recognitionOverrideLocale = this.getLocaleForBase((this.translationLanguage.value || 'en').toLowerCase());
                if (this.isRecording) this.stopRecording();
                this.startRecording();
                this._restartInProgress = false;
            });
        }
        this.speakButton.addEventListener('click', () => this.speakTranslation());
        
        // File upload event listeners
        if (this.audioFileInput) {
            this.audioFileInput.addEventListener('change', (event) => this.handleFileSelect(event));
        }
        if (this.processAudioButton) {
            this.processAudioButton.addEventListener('click', () => this.processAudioFile());
        }
        if (this.historyToggle) {
            this.historyToggle.addEventListener('click', () => this.toggleHistoryPanel());
        }
        if (this.clearHistoryButton) {
            this.clearHistoryButton.addEventListener('click', () => this.clearHistory());
        }
        if (this.stopSpeakButton) {
            this.stopSpeakButton.addEventListener('click', () => this.stopSpeaking());
        }
        if (this.compileButton && this.compileModal) {
            this.compileButton.addEventListener('click', () => this.showCompileModal());
            if (this.compileWordButton) this.compileWordButton.addEventListener('click', () => { this.hideCompileModal(); this.exportDoc(); });
            if (this.compilePdfButton) this.compilePdfButton.addEventListener('click', () => { this.hideCompileModal(); this.exportPdf(); });
            if (this.compileCancelButton) this.compileCancelButton.addEventListener('click', () => this.hideCompileModal());
        }
    }

    copyText(text) {
        if (!text) { this.showToast('Nothing to copy', 'error'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => { this.showToast('Copied to clipboard', 'success'); })
                .catch(() => { this.showToast('Copy failed', 'error'); });
        } else {
            this.showToast('Clipboard unavailable', 'error');
        }
    }

    downloadText(text, filename) {
        if (!text) { this.showToast('Nothing to download', 'error'); return; }
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast(`Downloaded ${filename}`, 'success');
    }

    clearSaved() {
        try {
            localStorage.removeItem('bv_last_original');
            localStorage.removeItem('bv_last_translation');
            this.lastDisplayedOriginal = '';
            this.lastTranslation = '';
            this.lastDisplayedKey = '';
            this.transcript = '';
            this.transcriptElement.textContent = '';
            this.speakButton.disabled = true;
        } catch (e) {}
        this.showToast('Cleared saved transcript', 'info');
    }

    toggleMenu() {
        if (!this.menuDropdown) return;
        const isOpen = this.menuDropdown.style.display === 'flex' || this.menuDropdown.style.display === 'block';
        this.menuDropdown.style.display = isOpen ? 'none' : 'flex';
    }

    closeMenu() {
        if (this.menuDropdown) this.menuDropdown.style.display = 'none';
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
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const audioData = await audioContext.decodeAudioData(event.target.result);
                const transcript = await this.simulateAudioTranscription(this.uploadedAudio.name);
                const translatedText = await this.translateToEnglish(transcript);
                this.updateTranscript(transcript, translatedText, '');
                this.statusElement.textContent = this.messages.AUDIO_PROCESSED;
                this.showToast('Audio processed', 'success');
            } catch (error) {
                console.error('Error processing audio:', error);
                this.statusElement.textContent = this.messages.AUDIO_ERROR;
                this.showToast('Audio processing failed', 'error');
            }
        };
        
        reader.onerror = () => {
            this.statusElement.textContent = this.messages.AUDIO_ERROR;
            this.showToast('Audio processing failed', 'error');
        };
        
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
            'gu': 'હેલો, આ અપલોડ રહતયા ઓડિયો ફાઇલ છે.',
            'default': 'Hello, this is an uploaded audio file that needs to be transcribed and translated.'
        };
        
        // Try to match the filename with a language
        const detectedLang = Object.keys(this.languageMapping).find(key => 
            filename.toLowerCase().includes(this.languageMapping[key])
        );
        
        const sourceLang = detectedLang ? this.languageMapping[detectedLang] : 'default';
        return sampleTexts[sourceLang] || sampleTexts['default'];
    }

    async startRecording() {
        if (!this.isSupported) {
            this.statusElement.textContent = this.messages.BROWSER_ERROR;
            this.showToast(this.messages.BROWSER_ERROR, 'error');
            return;
        }
        if (!window.isSecureContext && location.hostname !== 'localhost') {
            this.statusElement.textContent = 'Recording requires HTTPS or localhost.';
            this.showToast('Recording requires HTTPS or localhost', 'error');
            return;
        }
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.startVisualizer();
            }
            this.recognition.lang = this.recognitionOverrideLocale || this.languageSelect.value;
            this.recognition.start();
            this.isRecording = true;
            this.lastVoiceTs = Date.now();
            this.fullOriginal = '';
            this.fullTranslation = '';
            this.transcript = '';
            this.transcriptElement.textContent = '';
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.statusElement.textContent = this.messages.RECORDING;
            this.statusElement.classList.add('recording');
            this.showToast(this.messages.STARTED, 'info');
        } catch (error) {
            console.error('Error starting recognition:', error);
            const name = error && (error.name || error.code);
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                this.statusElement.textContent = this.messages.PERMISSION_ERROR;
                this.showToast(this.messages.PERMISSION_ERROR, 'error');
            } else {
                this.statusElement.textContent = this.messages.ERROR_START;
                this.showToast(this.messages.ERROR_START, 'error');
            }
        }
    }

    stopRecording() {
        if (!this.isSupported) {
            return;
        }
        try {
            this.recognition.stop();
            this.isRecording = false;
            this.stopVisualizer();
            if (this.micStream) {
                this.micStream.getTracks().forEach(t => t.stop());
                this.micStream = null;
            }
            
            this.startButton.disabled = false;
            this.stopButton.disabled = true;
            this.statusElement.textContent = this.messages.STOPPED;
            this.statusElement.classList.remove('recording');
            if (!this._restartInProgress) {
                this.isReverse = false;
                this.recognitionOverrideLocale = null;
            }
            this.lastVoiceTs = 0;
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }

    updateTranscript(finalOriginal, finalTranslation, interimTranscript) {
        const targetLangName = this.translationLanguage.options[this.translationLanguage.selectedIndex].text;
        const norm = (s) => String(s || '').trim().replace(/\s+/g,' ');
        const finalOrigNorm = norm(finalOriginal);
        const finalTransNorm = norm(finalTranslation);

        // Prefer current final original; fallback to last seen final; then last displayed
        let displayOriginal = finalOrigNorm || norm(this.lastOriginalSeen) || this.lastDisplayedOriginal;

        // Use original-only key to avoid missing display when translation is pending
        const originalKey = displayOriginal;
        const translationChanged = finalTransNorm && finalTransNorm !== this.lastDisplayedTranslation;

        // Always show original when available; include translation or placeholder
        if (displayOriginal && (originalKey !== this.lastDisplayedKey || translationChanged)) {
            this.lastDisplayedKey = originalKey;
            this.lastDisplayedOriginal = displayOriginal;
            this.lastDisplayedTranslation = finalTransNorm || '';
            this.lastTranslation = finalTransNorm || '';
            const transLine = finalTransNorm ? `${targetLangName} Translation: ${finalTransNorm}` : `${targetLangName} Translation: Translating…`;
            this.transcript = `Original: ${displayOriginal}\n${transLine}`;
            const canSpeak = this.mode === 'lesson' ? !!displayOriginal : !!finalTransNorm;
            this.speakButton.disabled = !canSpeak;
            try {
                localStorage.setItem('bv_last_original', displayOriginal);
                if (finalTransNorm) localStorage.setItem('bv_last_translation', finalTransNorm);
            } catch (e) {}
        }

        // While recording, show interim speaking line without duplicating blocks
        if (this.isRecording && this.mode === 'lesson' && interimTranscript) {
            const interim = norm(interimTranscript);
            this.transcriptElement.textContent = `${this.transcript}\nSpeaking: ${interim}`.trim();
        } else if (this.isRecording && !finalOrigNorm && interimTranscript) {
            const interim = norm(interimTranscript);
            this.transcriptElement.textContent = `${this.transcript}\nSpeaking: ${interim}`.trim();
        } else if (this.transcript) {
            this.transcriptElement.textContent = this.transcript;
        } else {
            this.transcriptElement.textContent = this.isRecording && interimTranscript ? `Speaking: ${norm(interimTranscript)}` : '';
        }
    }

    getSourceLangCode() {
        const v = (this.languageSelect.value || 'auto').split('-')[0].toLowerCase();
        return v || 'auto';
    }

    getLocaleForBase(lang) {
        const m = {
            en: 'en-US', hi: 'hi-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN',
            fr: 'fr-FR', es: 'es-ES', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN'
        };
        return m[lang] || 'en-US';
    }

    applyDisplayScript(text) {
        try {
            const sel = this.displayScriptSelect ? (this.displayScriptSelect.value || 'native') : 'native';
            const src = this.getSourceLangCode();
            if (!text) return '';
            if (sel === 'native') return text;
            if (sel === 'latin') return this.transliterateToLatin(text, src) || text;
            if (sel === src) return text;
            const out = this.transliterateToSpeakerScript(text, src, sel);
            return out || text;
        } catch (e) {
            return text;
        }
    }

    showCompileModal() { if (this.compileModal) this.compileModal.classList.add('show'); }
    hideCompileModal() { if (this.compileModal) this.compileModal.classList.remove('show'); }

    renderSessionContent() {
        const norm = (s) => String(s || '').trim().replace(/\s+/g,' ');
        const date = new Date().toLocaleString();
        const sl = this.languageSelect.options[this.languageSelect.selectedIndex].text;
        const tl = this.translationLanguage.options[this.translationLanguage.selectedIndex].text;
        const originalText = norm(this.fullOriginal);
        const translationText = norm(this.fullTranslation);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bharat Vaani Session</title>
        <style>body{font-family:Arial, sans-serif; padding:20px; color:#222} h1{margin-top:0} h2{margin:12px 0} .section{margin-bottom:16px} .meta{color:#555}</style>
        </head><body>
        <h1>Bharat Vaani Session</h1>
        <div class='meta'>Date: ${date}<br>Source: ${sl}<br>Target: ${tl}</div>
        <div class='section'><h2>Original</h2><div>${originalText.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div></div>
        <div class='section'><h2>Translation</h2><div>${translationText.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</div></div>
        </body></html>`;
        return html;
    }

    exportDoc() {
        const hasOriginal = String(this.fullOriginal || '').trim().length > 0;
        const hasTranslation = String(this.fullTranslation || '').trim().length > 0;
        if (!hasOriginal && !hasTranslation) { this.showToast('No content to export', 'error'); return; }
        if (this.mode === 'translation' && !hasTranslation) { this.showToast('No translation available; exporting original only', 'info'); }
        const html = this.renderSessionContent();
        const blob = new Blob([html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bharat_vaani_session.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Downloaded Word document', 'success');
    }

    exportPdf() {
        const hasOriginal = String(this.fullOriginal || '').trim().length > 0;
        const hasTranslation = String(this.fullTranslation || '').trim().length > 0;
        if (!hasOriginal && !hasTranslation) { this.showToast('No content to export', 'error'); return; }
        if (this.mode === 'translation' && !hasTranslation) { this.showToast('No translation available; exporting original only', 'info'); }
        const html = this.renderSessionContent();
        const w = window.open('', '_blank');
        if (!w) { this.showToast('Popup blocked. Allow popups to export PDF', 'error'); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        try { w.print(); } catch (e) {}
        this.showToast('Opened print dialog for PDF', 'info');
    }


    speakTranslation() {
        if (this.speechSynthesis.speaking) return;
        if (this.mode === 'lesson') {
            const text = this.lastDisplayedOriginal || this.lastOriginalSeen || this.fullOriginal;
            if (!text) return;
            const utterance = new SpeechSynthesisUtterance(text);
            const src = this.getSourceLangCode();
            utterance.lang = src === 'en' ? 'en-US' : src;
            const s = this.getTtsSettings(src);
            utterance.rate = s.rate;
            utterance.pitch = s.pitch;
            utterance.onstart = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = false; };
            utterance.onend = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = true; };
            utterance.onerror = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = true; };
            this.currentUtterance = utterance;
            this.speechSynthesis.speak(utterance);
            return;
        }
        if (this.lastTranslation) {
            const utterance = new SpeechSynthesisUtterance(this.lastTranslation);
            const baseSource = ((this.languageSelect.value || 'auto').split('-')[0] || 'auto').toLowerCase();
            const baseTarget = (this.translationLanguage.value || 'en').toLowerCase();
            const tl = this.isReverse ? baseSource : baseTarget;
            utterance.lang = tl === 'en' ? 'en-US' : tl;
            const s = this.getTtsSettings(tl);
            utterance.rate = s.rate;
            utterance.pitch = s.pitch;
            utterance.onstart = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = false; };
            utterance.onend = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = true; };
            utterance.onerror = () => { if (this.stopSpeakButton) this.stopSpeakButton.disabled = true; };
            this.currentUtterance = utterance;
            this.speechSynthesis.speak(utterance);
        }
    }

    stopSpeaking() {
        try {
            if (this.speechSynthesis && (this.speechSynthesis.speaking || this.speechSynthesis.paused)) {
                this.speechSynthesis.cancel();
            }
        } finally {
            if (this.stopSpeakButton) this.stopSpeakButton.disabled = true;
        }
    }

    getTtsSettings(lang) {
        const m = {
            en: { rate: 0.95, pitch: 1 },
            hi: { rate: 0.9, pitch: 1 },
            te: { rate: 0.9, pitch: 1 },
            ta: { rate: 0.9, pitch: 1 },
            kn: { rate: 0.92, pitch: 1 },
            ml: { rate: 0.9, pitch: 1 },
            mr: { rate: 0.9, pitch: 1 },
            bn: { rate: 0.9, pitch: 1 },
            gu: { rate: 0.9, pitch: 1 },
            fr: { rate: 0.95, pitch: 1 },
            es: { rate: 0.95, pitch: 1 },
            de: { rate: 0.95, pitch: 1 },
            ja: { rate: 0.85, pitch: 1 },
            zh: { rate: 0.85, pitch: 1 }
        };
        return m[lang] || { rate: 0.9, pitch: 1 };
    }

    async translateToEnglish(text) {
        const baseSource = ((this.languageSelect.value || 'auto').split('-')[0] || 'auto').toLowerCase();
        const baseTarget = (this.translationLanguage.value || 'en').toLowerCase();
        const sourceLang = this.isReverse ? baseTarget : baseSource;
        const targetLang = this.isReverse ? baseSource : baseTarget;

        const tryFetchJson = async (url, options = {}, timeoutMs = 8000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                return await res.json();
            } catch (e) {
                clearTimeout(id);
                throw e;
            }
        };

        // Provider 1: MyMemory
        try {
            const data = await tryFetchJson(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
            );
            if (data && data.responseStatus === 200 && data.responseData?.translatedText) {
                const out = data.responseData.translatedText;
                if (out && out.trim() && out.trim() !== text.trim()) {
                    return out;
                }
            }
        } catch (e) {
            console.warn('MyMemory translation failed:', e);
            if (!this._translationErrorShown) { this._translationErrorShown = true; this.showToast('Network issue: translation provider unavailable', 'error'); }
        }

        // Provider 2: LibreTranslate (public demo)
        try {
            const body = JSON.stringify({
                q: text,
                source: sourceLang === 'auto' ? 'auto' : sourceLang,
                target: targetLang,
                format: 'text'
            });
            const data2 = await tryFetchJson('https://libretranslate.de/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            if (data2 && data2.translatedText) {
                const out2 = data2.translatedText;
                if (out2 && out2.trim() && out2.trim() !== text.trim()) {
                    return out2;
                }
            }
        } catch (e) {
            console.warn('LibreTranslate fallback failed:', e);
            if (!this._translationErrorShown) { this._translationErrorShown = true; this.showToast('Network issue: translation provider unavailable', 'error'); }
        }

        // Provider 3: Google unofficial endpoint
        try {
            const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
            const tl = targetLang;
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
            const data3 = await tryFetchJson(url);
            if (Array.isArray(data3) && Array.isArray(data3[0])) {
                const segments = data3[0].map(seg => seg[0]).join('');
                if (segments && segments.trim() && segments.trim() !== text.trim()) {
                    return segments;
                }
            }
        } catch (e) {
            console.warn('Google translate fallback failed:', e);
            if (!this._translationErrorShown) { this._translationErrorShown = true; this.showToast('Network issue: translation provider unavailable', 'error'); }
        }

        // Fallback: return original text
        this.showToast('Translation unavailable; showing original', 'info');
        return text;
    }
}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpeechRecognitionSystem();
});
SpeechRecognitionSystem.prototype.showToast = function(message, kind = 'info') {
    if (!this.toastElement) return;
    this.toastElement.textContent = message;
    this.toastElement.className = `toast show ${kind}`;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
        if (this.toastElement) this.toastElement.className = 'toast';
    }, 2500);
};
SpeechRecognitionSystem.prototype.toggleTheme = function() {
    const body = document.body;
    const isDark = body.classList.toggle('dark');
    try { localStorage.setItem('bv_theme', isDark ? 'dark' : 'light'); } catch (e) {}
    this.showToast(isDark ? 'Dark mode on' : 'Light mode on', 'info');
};
SpeechRecognitionSystem.prototype.applySavedTheme = function() {
    let theme = 'light';
    try { theme = localStorage.getItem('bv_theme') || 'light'; } catch (e) {}
    if (theme === 'dark') document.body.classList.add('dark');
};
SpeechRecognitionSystem.prototype.startVisualizer = function() {
    if (!this.visualizerElement || !this.micStream) return;
    if (!this.visualizerBars || this.visualizerBars.length === 0) {
        this.visualizerBars = [];
        this.visualizerElement.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const d = document.createElement('div');
            d.className = 'bar';
            this.visualizerElement.appendChild(d);
            this.visualizerBars.push(d);
        }
    }
    this.audioContextVisualizer = new (window.AudioContext || window.webkitAudioContext)();
    const src = this.audioContextVisualizer.createMediaStreamSource(this.micStream);
    this.analyser = this.audioContextVisualizer.createAnalyser();
    this.analyser.fftSize = 256;
    src.connect(this.analyser);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const loop = () => {
        this.analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / this.visualizerBars.length);
        let maxV = 0;
        for (let i = 0; i < this.visualizerBars.length; i++) {
            const v = data[i * step] / 255;
            if (v > maxV) maxV = v;
            const h = Math.max(8, Math.min(60, Math.round(v * 60)));
            this.visualizerBars[i].style.height = h + 'px';
        }
        if (this.autoStopOnSilence && this.isRecording) {
            if (maxV > this.silenceThreshold) {
                this.lastVoiceTs = Date.now();
            }
            const elapsed = Date.now() - (this.lastVoiceTs || Date.now());
            if (elapsed > this.silenceTimeoutMs) {
                this.showToast('No input detected. Stopping recording', 'info');
                this.stopRecording();
            }
        }
        this.visualizerRAF = requestAnimationFrame(loop);
    };
    loop();
};
SpeechRecognitionSystem.prototype.stopVisualizer = function() {
    if (this.visualizerRAF) cancelAnimationFrame(this.visualizerRAF);
    this.visualizerRAF = null;
    if (this.audioContextVisualizer && this.audioContextVisualizer.state !== 'closed') {
        this.audioContextVisualizer.close();
    }
    if (this.visualizerBars) {
        for (const b of this.visualizerBars) b.style.height = '12px';
    }
};
SpeechRecognitionSystem.prototype.addHistory = function(original, translation) {
    const item = { o: original, t: translation, ts: Date.now(), sl: (this.languageSelect.value||''), tl: (this.translationLanguage.value||'') };
    let list = [];
    try { list = JSON.parse(localStorage.getItem('bv_history') || '[]'); } catch (e) {}
    list.unshift(item);
    list = list.slice(0, 5);
    try { localStorage.setItem('bv_history', JSON.stringify(list)); } catch (e) {}
    this.renderHistory(list);
};
SpeechRecognitionSystem.prototype.renderHistory = function(list) {
    if (!this.historyList) return;
    let l = list;
    if (!l) {
        try { l = JSON.parse(localStorage.getItem('bv_history') || '[]'); } catch (e) { l = []; }
    }
    this.historyList.innerHTML = '';
    for (const it of l) {
        const d = document.createElement('div');
        d.className = 'history-item';
        const title = document.createElement('div');
        title.className = 'history-title';
        const sln = this.languageSelect.options[this.languageSelect.selectedIndex].text;
        const tln = this.translationLanguage.options[this.translationLanguage.selectedIndex].text;
        title.textContent = `${sln} → ${tln}`;
        const o = document.createElement('div');
        o.className = 'history-text';
        o.textContent = it.o;
        const t = document.createElement('div');
        t.className = 'history-text';
        t.textContent = it.t;
        d.appendChild(title);
        d.appendChild(o);
        d.appendChild(t);
        this.historyList.appendChild(d);
    }
};
SpeechRecognitionSystem.prototype.toggleHistoryPanel = function() {
    if (!this.historyPanel) return;
    const isShown = this.historyPanel.classList.contains('show');
    if (isShown) {
        this.historyPanel.classList.remove('show');
    } else {
        this.historyPanel.classList.add('show');
        this.renderHistory();
    }
};
SpeechRecognitionSystem.prototype.clearHistory = function() {
    try { localStorage.removeItem('bv_history'); } catch (e) {}
    this.renderHistory([]);
    this.showToast('History cleared', 'info');
};
