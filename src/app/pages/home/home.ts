import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Camera } from '../../components/camera/camera';
import { FirebaseService } from '../../services/firebase.service';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Camera],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {
  @ViewChild(Camera) cameraComponent!: Camera;
  
  statusMessage = "Carregando funcionários...";
  success = false;
  faceMatcher: faceapi.FaceMatcher | null = null;
  processing = false;
  locationName: string = '';

  constructor(
    private firebaseService: FirebaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.locationName = this.firebaseService.kioskLocation;
    
    try {
      const employees = await this.firebaseService.getEmployees();
      if (employees.length === 0) {
        this.statusMessage = "Nenhum funcionário cadastrado. Vá para /admin.";
        this.cdr.detectChanges();
        return;
      }

      const labeledDescriptors = employees.map(emp => {
        const descriptorArray = new Float32Array(emp.descriptor);
        return new faceapi.LabeledFaceDescriptors(emp.name + "||" + emp.id, [descriptorArray]);
      });

      this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
      this.statusMessage = "Aguardando reconhecimento facial...";
      this.cdr.detectChanges();
    } catch (error) {
      console.error(error);
      this.statusMessage = "Erro ao conectar com o banco de dados.";
      this.cdr.detectChanges();
    }
  }

  async onFaceDetected(descriptor: Float32Array) {
    if (!this.faceMatcher || this.processing) return;

    this.processing = true;
    this.statusMessage = "Analisando rosto...";
    this.cdr.detectChanges();

    const match = this.faceMatcher.findBestMatch(descriptor);

    if (match.label !== 'unknown') {
      const [name, id] = match.label.split("||");
      
      // Desligar câmera imediatamente para economizar
      if (this.cameraComponent) {
        this.cameraComponent.stopCamera();
      }
      
      this.statusMessage = `Salvando ponto para ${name}...`;
      this.cdr.detectChanges();

      try {
        const result = await this.firebaseService.registerClockIn(id, name);
        this.statusMessage = `${name} | ${result.status} às ${result.time}`;
        this.success = true;
        this.cdr.detectChanges();
      } catch (err) {
        console.error("Erro ao registrar no banco: ", err);
        this.statusMessage = `Erro ao salvar o ponto. Tente novamente.`;
        this.cdr.detectChanges();
      }

      // Trava por 5 segundos para o funcionário ler a mensagem antes de reiniciar
      setTimeout(() => {
        this.statusMessage = "Aguardando reconhecimento facial...";
        this.success = false;
        this.processing = false;
        this.cdr.detectChanges();
      }, 5000);
    } else {
      this.statusMessage = "Rosto desconhecido! Tente novamente.";
      this.success = false;
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.statusMessage = "Aguardando reconhecimento facial...";
        this.processing = false;
        this.cdr.detectChanges();
      }, 2000);
    }
  }
}
