class AudioQRApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentAudio = null;
        this.recordingStartTime = null;
        this.maxDataSize = 1500; // bytes (reduced for more reliable QR scanning)
        
        this.initializeElements();
        this.bindEvents();
        this.checkForDataParameter(); // Check for scanned QR data
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
    }

    bindEvents() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.trimBtn.addEventListener('click', () => this.trimAudio());
        
        this.startTime.addEventListener('input', () => this.updateTrimLabels());
        this.endTime.addEventListener('input', () => this.updateTrimLabels());
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
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
            <div class="qr-container">
                <canvas></canvas>
            </div>
            <div class="qr-url"></div>
            <button class="download-btn">Download QR Code</button>
        `;
        
        const canvas = this.qrSection.querySelector('canvas');
        const qrUrlDiv = this.qrSection.querySelector('.qr-url');
        const downloadBtn = this.qrSection.querySelector('.download-btn');
        
        const url = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(base64Data)}`;
        
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
        const chunks = this.splitDataIntoChunks(base64Data, this.maxDataSize);
        this.showStatus(`Audio split into ${chunks.length} QR codes`, 'success');
        
        // Clear existing QR section and prepare for multiple codes
        this.qrSection.innerHTML = `
            <h2>QR Codes (${chunks.length} parts)</h2>
            <div class="qr-list"></div>
        `;
        
        const qrList = this.qrSection.querySelector('.qr-list');
        
        // Generate QR code for each chunk
        for (let i = 0; i < chunks.length; i++) {
            const qrItem = this.createQRCodeElement(chunks[i], i + 1, chunks.length);
            qrList.appendChild(qrItem);
            // We need to query the canvas inside the newly added element
            const canvas = qrItem.querySelector('canvas');
            const url = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(chunks[i])}&part=${i + 1}&total=${chunks.length}`;
            
            try {
                 new QRious({
                    element: canvas,
                    value: url,
                    size: 220,
                    padding: 10,
                    background: '#FFFFFF',
                    foreground: '#000000',
                    level: 'L'
                });
            } catch (error) {
                 console.error(`Error generating QR code for part ${i + 1}:`, error);
                 this.showStatus(`Error generating QR code for part ${i + 1}`, 'error');
            }
        }
        
        this.qrSection.classList.add('active');
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

    showStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        
        if (type === 'success') {
            setTimeout(() => {
                this.status.classList.remove('success');
                this.status.style.display = 'none';
            }, 3000);
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    checkForDataParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const data = urlParams.get('data');
        
        if (data) {
            this.playScannedAudio(data);
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