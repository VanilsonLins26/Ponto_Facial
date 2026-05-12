import { Component, OnInit } from '@angular/core';
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
  statusMessage = "Carregando funcionários...";
  success = false;
  faceMatcher: faceapi.FaceMatcher | null = null;
  processing = false;
  locationName: string = '';

  constructor(private firebaseService: FirebaseService) {}

  async ngOnInit() {
    this.locationName = this.firebaseService.kioskLocation;
    
    try {
      const employees = await this.firebaseService.getEmployees();
      if (employees.length === 0) {
        this.statusMessage = "Nenhum funcionário cadastrado. Vá para /admin.";
        return;
      }

      const labeledDescriptors = employees.map(emp => {
        // Converter o array de volta para Float32Array
        const descriptorArray = new Float32Array(emp.descriptor);
        return new faceapi.LabeledFaceDescriptors(emp.name + "||" + emp.id, [descriptorArray]);
      });

      // Distância máxima Euclidiana (0.6 é o padrão, menor = mais rigoroso)
      this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
      this.statusMessage = "Aguardando reconhecimento facial...";
    } catch (error) {
      console.error(error);
      this.statusMessage = "Erro ao conectar com o banco de dados.";
    }
  }

  async onFaceDetected(descriptor: Float32Array) {
    if (!this.faceMatcher || this.processing) return;

    this.processing = true;
    this.statusMessage = "Analisando rosto...";

    const match = this.faceMatcher.findBestMatch(descriptor);

    if (match.label !== 'unknown') {
      const [name, id] = match.label.split("||");
      this.statusMessage = `Ponto registrado para ${name}!`;
      this.success = true;

      // Registrar no Firebase de forma assíncrona
      this.firebaseService.registerClockIn(id, name).catch(err => {
         console.error("Erro ao registrar no banco: ", err);
      });

      // Trava por 4 segundos para evitar duplo registro
      setTimeout(() => {
        this.statusMessage = "Aguardando reconhecimento facial...";
        this.success = false;
        this.processing = false;
      }, 4000);
    } else {
      this.statusMessage = "Rosto desconhecido! Tente novamente.";
      this.success = false;
      
      setTimeout(() => {
        this.statusMessage = "Aguardando reconhecimento facial...";
        this.processing = false;
      }, 2000);
    }
  }
}
