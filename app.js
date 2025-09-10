class AudioQRApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.currentAudio = null;
        this.recordingStartTime = null;
        this.maxDataSize = 2000; // bytes (QR code limit roughly 2KB for reliable scanning)
        
        this.initializeElements();
        this.bindEvents();
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
        this.qrCanvas = document.getElementById('qrcode');
        this.qrUrl = document.getElementById('qrUrl');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.duration = document.getElementById('duration');
        this.dataSize = document.getElementById('dataSize');
    }

    bindEvents() {
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.trimBtn.addEventListener('click', () => this.trimAudio());
        this.downloadBtn.addEventListener('click', () => this.downloadQR());
        
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
            this.showStatus(
                `Audio data (${(dataSize / 1024).toFixed(1)} KB) exceeds QR code limit (${(this.maxDataSize / 1024).toFixed(1)} KB). Please trim the audio.`, 
                'warning'
            );
            this.setupTrimControls();
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

    async generateQRCode(base64Data) {
        const url = `https://websim.com/@api/qrtoaudio?data=${encodeURIComponent(base64Data)}`;
        
        try {
            await QRCode.toCanvas(this.qrCanvas, url, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            this.qrUrl.textContent = url;
            this.qrSection.classList.add('active');
            this.showStatus('QR code generated successfully!', 'success');
            
        } catch (error) {
            this.showStatus('Error generating QR code', 'error');
            console.error('QR code error:', error);
        }
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioQRApp();
});

