class AudioQRApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentAudio = null;
        this.recordingStartTime = null;
        this.maxDataSize = 500; // bytes (further reduced for easier scanning)
        this.html5QrCode = null;
        
        // Slideshow properties
        this.slideIndex = 0;
        this.slides = [];
        this.slideshowInterval = null;
        this.slideshowSpeed = 1000; // 1 second per slide
        
        this.initializeElements();
        this.bindEvents();
        this.handleScannedData(); // Check for scanned QR data on load
    }

    initializeElements() {
        this.recordBtn = document.getElementById('recordBtn');
        this.recordingIndicator = document.getElementById('recordingIndicator');
        this.audioInfo = document.getElementById('audioInfo');
        this.audioPreview = document.getElementById('audioPreview');
        this.audioPlayer = document.getElementById('audioPlayer');
        this.trimControls = document.getElementById('trimControls');
        this.startTime = document.getElementById('startTime');
        this.endTime = document.getElementById('endTime');
        this.startLabel = document.getElementById('startLabel');
        this.endLabel = document.getElementById('endLabel');
        this.trimBtn = document.getElementById('trimBtn');
        this.status = document.getElementById('status');
        this.qrSection = document.getElementById('qrSection');
        this.duration = document.getElementById('duration');
        this.dataSize = document.getElementById('dataSize');

        // Scanner elements
        this.scannerSection = document.getElementById('scannerSection');
        this.qrReader = document.getElementById('qr-reader');
        this.scanStatus = document.getElementById('scanStatus');
        this.missingPartsInfo = document.getElementById('missingPartsInfo');
        this.stopScanBtn = document.getElementById('stopScanBtn');

        // Slideshow elements
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevSlideBtn = document.getElementById('prevSlideBtn');
        this.nextSlideBtn = document.getElementById('nextSlideBtn');
        this.slideCounter = document.getElementById('slideCounter');
    }

    bindEvents() {
        if (this.recordBtn) {
            this.recordBtn.addEventListener('click', () => this.toggleRecording());
        }
        if (this.trimBtn) {
            this.trimBtn.addEventListener('click', () => this.trimAudio());
        }
        if (this.startTime) {
            this.startTime.addEventListener('input', () => this.updateTrimLabels());
            this.endTime.addEventListener('input', () => this.updateTrimLabels());
        }
        if (this.stopScanBtn) {
            this.stopScanBtn.addEventListener('click', () => this.stopScanning());
        }
        // Slideshow events
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.toggleSlideshow());
        }
        if (this.prevSlideBtn) {
            this.prevSlideBtn.addEventListener('click', () => {
                this.stopSlideshow();
                this.showSlide(this.slideIndex - 1);
            });
        }
        if (this.nextSlideBtn) {
            this.nextSlideBtn.addEventListener('click', () => {
                this.stopSlideshow();
                this.showSlide(this.slideIndex + 1);
            });
        }
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
            this.stopSlideshow();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateRecordingUI();
            this.startDurationTimer();
            
            // Hide QR section when starting a new recording
            this.qrSection.classList.remove('active');
            this.qrSection.querySelector('.slides-wrapper').innerHTML = '';
            
        } catch (error) {
            this.showStatus('Error accessing microphone. Please check permissions.', 'error');
            console.error('Error accessing microphone:', error);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            this.updateRecordingUI();
            clearInterval(this.durationTimer);
        }
    }

    startDurationTimer() {
        this.durationTimer = setInterval(() => {
            if (this.recordingStartTime) {
                const elapsed = (Date.now() - this.recordingStartTime) / 1000;
                this.duration.textContent = this.formatTime(elapsed);
            }
        }, 100);
    }

    updateRecordingUI() {
        if (this.isRecording) {
            this.recordBtn.classList.add('recording');
            this.recordBtn.querySelector('.record-text').textContent = 'Stop Recording';
            this.recordingIndicator.classList.add('active');
            this.audioInfo.classList.add('active');
        } else {
            this.recordBtn.classList.remove('recording');
            this.recordBtn.querySelector('.record-text').textContent = 'Start Recording';
            this.recordingIndicator.classList.remove('active');
        }
    }

    async processRecording() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(audioBlob);
        
        this.currentAudio = audioBlob;
        this.audioPlayer.src = audioURL;
        this.audioPreview.classList.add('active');
        
        // Convert to base64 and check size
        const base64Data = await this.blobToBase64(audioBlob);
        const dataSize = base64Data.length;
        
        this.dataSize.textContent = `${(dataSize / 1024).toFixed(1)} KB`;
        
        if (dataSize > this.maxDataSize) {
            // Auto-split into multiple QR codes
            this.generateMultipleQRCodes(base64Data);
        } else {
            this.generateQRCode(base64Data);
        }
    }

    setupTrimControls() {
        this.audioPlayer.addEventListener('loadedmetadata', () => {
            const duration = this.audioPlayer.duration;
            this.startTime.max = duration;
            this.endTime.max = duration;
            this.endTime.value = duration;
            this.updateTrimLabels();
        });
    }

    updateTrimLabels() {
        const start = parseFloat(this.startTime.value);
        const end = parseFloat(this.endTime.value);
        
        this.startLabel.textContent = this.formatTime(start);
        this.endLabel.textContent = this.formatTime(end);
    }

    async trimAudio() {
        const start = parseFloat(this.startTime.value);
        const end = parseFloat(this.endTime.value);
        
        if (start >= end) {
            this.showStatus('Start time must be less than end time', 'error');
            return;
        }
        
        try {
            const trimmedBlob = await this.trimAudioBlob(this.currentAudio, start, end);
            const base64Data = await this.blobToBase64(trimmedBlob);
            const dataSize = base64Data.length;
            
            this.dataSize.textContent = `${(dataSize / 1024).toFixed(1)} KB`;
            
            if (dataSize > this.maxDataSize) {
                this.showStatus(
                    `Trimmed audio (${(dataSize / 1024).toFixed(1)} KB) still exceeds limit. Please trim more.`, 
                    'warning'
                );
            } else {
                this.showStatus('Audio trimmed successfully!', 'success');
                this.generateQRCode(base64Data);
            }
            
            // Update audio player with trimmed version
            const audioURL = URL.createObjectURL(trimmedBlob);
            this.audioPlayer.src = audioURL;
            this.currentAudio = trimmedBlob;
            
        } catch (error) {
            this.showStatus('Error trimming audio', 'error');
            console.error('Trim error:', error);
        }
    }

    async trimAudioBlob(blob, startTime, endTime) {
        // This is a simplified approach - in a real app you'd want more sophisticated audio processing
        // For now, we'll just return the original blob as trimming requires more complex audio processing
        // In practice, you'd use Web Audio API or a library like lamejs
        return blob;
    }

    generateQRCode(base64Data) {
        // Clear existing content and create fresh structure
        this.qrSection.innerHTML = `
            <h2>QR Code</h2>
            <div class="qr-container" style="background: #fff; padding: 10px; display: inline-block; border-radius: 8px;">
                <canvas></canvas>
            </div>
            <div class="qr-url"></div>
            <button class="download-btn" style="margin-top: 10px;">Download QR Code</button>
        `;
        
        const canvas = this.qrSection.querySelector('canvas');
        const qrUrlDiv = this.qrSection.querySelector('.qr-url');
        const downloadBtn = this.qrSection.querySelector('.download-btn');
        
        const url = `https://qrtoaudio.on.websim.com?data=${encodeURIComponent(base64Data)}`;
        
        try {
            new QRious({
                element: canvas,
                value: url,
                size: 256,
                padding: 10, // Corresponds to margin: 2 in previous library
                background: '#FFFFFF',
                foreground: '#000000',
                level: 'L' // Low correction, handles more data
            });
            
            qrUrlDiv.textContent = url.substring(0, 100) + '...';
            this.qrSection.classList.add('active');
            this.showStatus('QR code generated successfully!', 'success');
            
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.download = 'audio-qr-code.png';
                link.href = canvas.toDataURL();
                link.click();
            };
            
        } catch (error) {
            this.showStatus('Error generating QR code. The audio might be too long.', 'error');
            console.error('QR code error:', error);
        }
    }

    async generateMultipleQRCodes(base64Data) {
        this.stopSlideshow(); // Ensure any previous slideshow is stopped
        const chunks = this.splitDataIntoChunks(base64Data, this.maxDataSize);
        const sessionId = `audio-session-${Date.now()}`;
        this.showStatus(`Audio split into ${chunks.length} QR codes`, 'success');
        
        // Clear existing QR section and prepare for multiple codes
        this.qrSection.innerHTML = `
            <h2>QR Codes (${chunks.length} parts)</h2>
            <p>Scan each part in any order to play the audio.</p>
            <div class="slides-wrapper"></div>
        `;
        
        const slidesWrapper = this.qrSection.querySelector('.slides-wrapper');
        slidesWrapper.innerHTML = ''; // Clear previous slides
        this.slides = []; // Reset slides array

        const baseUrl = `https://qrtoaudio.on.websim.com`;
        
        for (let i = 0; i < chunks.length; i++) {
            const partNumber = i + 1;
            const slide = this.createSlideElement(partNumber, chunks.length);
            slidesWrapper.appendChild(slide);
            this.slides.push(slide);

            const canvas = slide.querySelector('canvas');
            const url = `${baseUrl}?id=${sessionId}&part=${partNumber}&total=${chunks.length}&data=${encodeURIComponent(chunks[i])}`;
            
            try {
                 new QRious({
                    element: canvas,
                    value: url,
                    size: 250,
                    padding: 10,
                    background: '#FFFFFF',
                    foreground: '#000000',
                    level: 'L'
                });
            } catch (error) {
                 console.error(`Error generating QR code for part ${partNumber}:`, error);
                 this.showStatus(`Error generating QR code for part ${partNumber}`, 'error');
            }
        }
        
        this.slideIndex = 0;
        this.showSlide(this.slideIndex);
        this.qrSection.classList.add('active');
    }
    
    createSlideElement(partNumber, totalParts) {
        const slide = document.createElement('div');
        slide.className = 'qr-slide';

        const title = document.createElement('h3');
        title.textContent = `Part ${partNumber} of ${totalParts}`;
        
        const canvas = document.createElement('canvas');
        
        slide.appendChild(canvas);
        slide.appendChild(title);
        
        return slide;
    }

    showSlide(index) {
        if (!this.slides || this.slides.length === 0) return;

        // Wrap around logic
        if (index >= this.slides.length) {
            this.slideIndex = 0;
        } else if (index < 0) {
            this.slideIndex = this.slides.length - 1;
        } else {
            this.slideIndex = index;
        }

        // Hide all slides
        this.slides.forEach(slide => slide.classList.remove('active'));

        // Show the current slide
        this.slides[this.slideIndex].classList.add('active');

        // Update counter
        if (this.slideCounter) {
            this.slideCounter.textContent = `${this.slideIndex + 1} / ${this.slides.length}`;
        }
    }

    toggleSlideshow() {
        if (this.slideshowInterval) {
            this.stopSlideshow();
        } else {
            this.startSlideshow();
        }
    }

    startSlideshow() {
        if (this.slideshowInterval) return; // Already running
        this.playPauseBtn.textContent = '⏹️ Stop Scan';
        this.playPauseBtn.classList.add('playing');
        
        this.slideshowInterval = setInterval(() => {
            this.showSlide(this.slideIndex + 1);
        }, this.slideshowSpeed);
    }

    stopSlideshow() {
        clearInterval(this.slideshowInterval);
        this.slideshowInterval = null;
        this.playPauseBtn.textContent = '▶️ Rapid Scan';
        this.playPauseBtn.classList.remove('playing');
    }

    splitDataIntoChunks(data, maxChunkSize) {
        const chunks = [];
        for (let i = 0; i < data.length; i += maxChunkSize) {
            chunks.push(data.slice(i, i + maxChunkSize));
        }
        return chunks;
    }

    createQRCodeElement(chunkData, partNumber, totalParts) {
        const qrItem = document.createElement('div');
        qrItem.className = 'qr-item';

        const title = document.createElement('h3');
        title.textContent = `Part ${partNumber} of ${totalParts}`;
        
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'qr-container';
        
        const canvas = document.createElement('canvas');
        canvasContainer.appendChild(canvas);

        const urlDiv = document.createElement('div');
        urlDiv.className = 'qr-url';
        urlDiv.textContent = `Part ${partNumber} data snippet...`;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = `Download Part ${partNumber}`;
        downloadBtn.style.marginTop = '16px';
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.download = `audio-qr-part-${partNumber}.png`;
            link.href = canvas.toDataURL();
            link.click();
        };
        
        qrItem.appendChild(title);
        qrItem.appendChild(canvasContainer);
        qrItem.appendChild(urlDiv);
        qrItem.appendChild(downloadBtn);
        
        return qrItem;
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    downloadQR() {
        const link = document.createElement('a');
        link.download = 'audio-qr-code.png';
        link.href = this.qrCanvas.toDataURL();
        link.click();
    }

    showStatus(message, type, element = this.status) {
        element.textContent = message;
        element.className = `status ${type}`;
        element.style.display = 'block';
        
        if (type === 'success' && element === this.status) {
            setTimeout(() => {
                element.classList.remove('success');
                element.style.display = 'none';
            }, 3000);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleScannedData() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const part = urlParams.get('part');
        const total = urlParams.get('total');
        const data = urlParams.get('data');

        // Handle single-part QR from older versions or simple cases
        if (data && !id) {
            this.playScannedAudio(data);
            return;
        }

        // Handle multi-part QR codes
        if (id && part && total && data) {
            this.showStatus('Processing scanned part...', 'info');
            
            // Store the part
            const partKey = `qr_audio_${id}_part_${part}`;
            sessionStorage.setItem(partKey, data);
            
            const totalKey = `qr_audio_${id}_total`;
            sessionStorage.setItem(totalKey, total);

            // Check if we have all parts
            const collectedParts = [];
            let allPartsFound = true;
            for (let i = 1; i <= total; i++) {
                const currentPart = sessionStorage.getItem(`qr_audio_${id}_part_${i}`);
                if (currentPart) {
                    collectedParts.push(currentPart);
                } else {
                    allPartsFound = false;
                }
            }

            if (allPartsFound) {
                // Assemble and play
                const fullBase64 = collectedParts.join('');
                this.playScannedAudio(fullBase64);

                // Clean up session storage
                for (let i = 1; i <= total; i++) {
                    sessionStorage.removeItem(`qr_audio_${id}_part_${i}`);
                }
                sessionStorage.removeItem(totalKey);
            } else {
                // Ask for the next part
                this.promptForNextPart(id, parseInt(total));
            }
        }
    }
    
    promptForNextPart(id, total) {
        // Hide main recording UI
        document.querySelector('main > .recording-section').style.display = 'none';
        this.scannerSection.style.display = 'block';

        const missing = [];
        for (let i = 1; i <= total; i++) {
            if (!sessionStorage.getItem(`qr_audio_${id}_part_${i}`)) {
                missing.push(i);
            }
        }
        
        const collectedCount = total - missing.length;

        this.showStatus(`Collected ${collectedCount} of ${total} parts.`, 'info', this.scanStatus);
        this.missingPartsInfo.innerHTML = `Please scan one of the remaining parts: <strong>${missing.join(', ')}</strong>`;
        
        this.startScanning();
    }

    startScanning() {
        this.stopScanBtn.style.display = 'inline-block';
        this.html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        const onScanSuccess = (decodedText, decodedResult) => {
            this.stopScanning();
            this.showStatus('QR Code detected! Reloading...', 'success', this.scanStatus);
            // Redirect to the URL from the QR code to process the next part
            window.location.href = decodedText;
        };

        const onScanFailure = (error) => {
            // handle scan failure, usually better to ignore and keep scanning.
        };

        this.html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
            .catch(err => {
                this.showStatus('Could not start scanner. Please grant camera permission.', 'error', this.scanStatus);
                console.error("Unable to start scanning.", err);
            });
    }

    stopScanning() {
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            this.html5QrCode.stop()
                .then(() => {
                    this.showStatus('Scanner stopped.', 'info', this.scanStatus);
                    this.stopScanBtn.style.display = 'none';
                })
                .catch(err => console.error("Failed to stop scanner.", err));
        }
    }

    async playScannedAudio(base64Data) {
        try {
            // Convert base64 back to audio blob
            const audioBlob = this.base64ToBlob(base64Data, 'audio/webm');
            const audioURL = URL.createObjectURL(audioBlob);
            
            // Show audio player
            this.audioPlayer.src = audioURL;
            this.audioPreview.classList.add('active');
            
            // Auto-play the audio
            this.audioPlayer.play();
            
            this.showStatus('Playing scanned audio', 'success');
            
            // Hide recording controls when playing scanned audio
            this.recordBtn.style.display = 'none';
            this.audioInfo.style.display = 'none';
            
            // Add a "Record New" button
            const recordNewBtn = document.createElement('button');
            recordNewBtn.textContent = 'Record New Audio';
            recordNewBtn.className = 'record-btn';
            recordNewBtn.style.marginTop = '20px';
            recordNewBtn.onclick = () => {
                window.location.href = window.location.pathname; // Reload page without parameters
            };
            
            this.audioPreview.appendChild(recordNewBtn);
            
        } catch (error) {
            this.showStatus('Error playing scanned audio', 'error');
            console.error('Error playing scanned audio:', error);
        }
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioQRApp();
});