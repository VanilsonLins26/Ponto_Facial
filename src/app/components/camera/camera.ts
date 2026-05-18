import { Component, ElementRef, OnInit, ViewChild, OnDestroy, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
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
  isFaceCentered: boolean = false;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.loadModels();
  }

  async loadModels() {
    try {
      // Retornando para auto-detecção original do face-api (que usa WebGL por padrão)
      // pois descobrimos que o problema real pode ser atualização de tela (Change Detection).
      await faceapi.tf.setBackend('webgl').catch(() => faceapi.tf.setBackend('cpu'));
      await faceapi.tf.ready();
      console.log("Motor inicializado.");

      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      
      console.log("✅ Modelos carregados com sucesso! Atualizando tela...");
      this.modelsLoaded = true;
      this.cdr.detectChanges(); // FORÇA o Angular a atualizar a tela!
      
    } catch (err: any) {
      console.error("Erro ao carregar modelos da IA:", err);
      this.loadError = "Erro ao carregar IA: " + err.message;
      this.cdr.detectChanges();
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
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          const box = detections.detection.box;
          
          // Centro do rosto detectado
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          
          // Centro do vídeo (centro da elipse)
          const videoCenterX = videoWidth / 2;
          const videoCenterY = videoHeight / 2;
          
          // Raio X (horizontal) da elipse: metade de 70% da largura (pois o guia tem 70% de largura)
          const rx = videoWidth * 0.35;
          // Raio Y (vertical) da elipse: o guia tem aspect-ratio 3/4 (altura é 4/3 da largura)
          const ry = rx * (4 / 3);
          
          // Equação da elipse: (x - cx)² / rx² + (y - cy)² / ry² <= 1
          const ellipseValue = Math.pow((faceCenterX - videoCenterX) / rx, 2) + Math.pow((faceCenterY - videoCenterY) / ry, 2);
          
          // O rosto está dentro da elipse e tem um tamanho razoável?
          const isInside = ellipseValue <= 1;
          const isLargeEnough = box.width >= (videoWidth * 0.25);

          if (isInside && isLargeEnough) {
            if (!this.isFaceCentered) {
              this.isFaceCentered = true;
              this.cdr.detectChanges();
            }
            
            console.log("✅ Rosto detectado e centralizado!");
            const resizedDetections = faceapi.resizeResults(detections, { width: videoWidth, height: videoHeight });
            const ctx = canvas.getContext('2d');
            if(ctx) {
               ctx.clearRect(0, 0, canvas.width, canvas.height);
               faceapi.draw.drawDetections(canvas, resizedDetections);
               faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            }
            
            this.faceDetected.emit(detections.descriptor);
          } else {
            if (this.isFaceCentered) {
              this.isFaceCentered = false;
              this.cdr.detectChanges();
            }
            const ctx = canvas.getContext('2d');
            if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            console.log("Rosto fora do centro ou muito pequeno...");
          }
        } else {
          if (this.isFaceCentered) {
            this.isFaceCentered = false;
            this.cdr.detectChanges();
          }
          const ctx = canvas.getContext('2d');
          if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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

