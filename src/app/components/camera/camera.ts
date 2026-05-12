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
  loadError: string = '';

  async ngOnInit() {
    await this.loadModels();
  }

  async loadModels() {
    try {
      // Inicialização segura do motor matemático (com fallback para CPU se o WebGL falhar)
      try {
        await faceapi.tf.setBackend('webgl');
        await faceapi.tf.ready();
        console.log("Motor WebGL inicializado com sucesso.");
      } catch (backendError) {
        console.warn("WebGL não suportado pelo navegador ou placa de vídeo. Usando CPU...", backendError);
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.ready();
        console.log("Motor CPU inicializado com sucesso.");
      }

      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      this.modelsLoaded = true;
    } catch (err: any) {
      console.error("Erro ao carregar modelos da IA:", err);
      this.loadError = "Erro ao carregar IA: " + err.message;
    }
  }

  async startCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        this.videoElement.nativeElement.srcObject = this.stream;
        
        // Forçar a reprodução
        await this.videoElement.nativeElement.play().catch(e => console.error("Play error:", e));
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
    console.log("Evento (play) da câmera disparado!");
    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    
    // Assegurar que o vídeo tem dimensões carregadas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
       console.warn("Vídeo sem dimensões, aguardando...");
       setTimeout(() => this.onVideoPlay(), 500);
       return;
    }

    faceapi.matchDimensions(canvas, video);

    this.detectionInterval = setInterval(async () => {
      try {
        const detections = await faceapi.detectSingleFace(video)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detections) {
          console.log("✅ Rosto detectado com sucesso!");
          const resizedDetections = faceapi.resizeResults(detections, { width: video.videoWidth, height: video.videoHeight });
          const ctx = canvas.getContext('2d');
          if(ctx) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             faceapi.draw.drawDetections(canvas, resizedDetections);
             faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          }
          
          this.faceDetected.emit(detections.descriptor);
        } else {
          console.log("Procurando rosto na imagem...");
        }
      } catch (error) {
        console.error("Erro interno do face-api:", error);
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}

