import { Component, ElementRef, OnInit, ViewChild, OnDestroy, Output, EventEmitter } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-camera',
  standalone: true,
  imports: [],
  templateUrl: './camera.html',
  styleUrl: './camera.css',
})
export class Camera implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
  @Output() faceDetected = new EventEmitter<Float32Array>();

  modelsLoaded = false;
  stream: MediaStream | null = null;
  detectionInterval: any;

  async ngOnInit() {
    await this.loadModels();
    this.modelsLoaded = true;
  }

  async loadModels() {
    const MODEL_URL = '/models';
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
  }

  async startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        this.videoElement.nativeElement.srcObject = this.stream;
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }
  }

  onVideoPlay() {
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    faceapi.matchDimensions(canvas, video);

    this.detectionInterval = setInterval(async () => {
      const detections = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, { width: video.videoWidth, height: video.videoHeight });
        const ctx = canvas.getContext('2d');
        if(ctx) {
           ctx.clearRect(0, 0, canvas.width, canvas.height);
           faceapi.draw.drawDetections(canvas, resizedDetections);
           faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        }
        
        this.faceDetected.emit(detections.descriptor);
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
