import { Component, OnInit } from '@angular/core';
import { Camera } from '../../components/camera/camera';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../services/firebase.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [Camera, CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class Admin implements OnInit {
  employeeName: string = '';
  capturedDescriptor: Float32Array | null = null;
  savedMessage: string = '';
  saving: boolean = false;
  
  employees: any[] = [];
  logs: any[] = [];

  constructor(private firebaseService: FirebaseService, private router: Router) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.employees = await this.firebaseService.getEmployees();
      this.logs = await this.firebaseService.getLogs();
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    }
  }

  onFaceDetected(descriptor: Float32Array) {
    if (!this.capturedDescriptor) {
      this.capturedDescriptor = descriptor;
    }
  }

  async saveEmployee() {
    if (!this.employeeName || !this.capturedDescriptor || this.saving) {
      return;
    }

    this.saving = true;
    try {
      await this.firebaseService.saveEmployee(
        this.employeeName, 
        Array.from(this.capturedDescriptor)
      );

      this.savedMessage = `Funcionário(a) ${this.employeeName} cadastrado(a) com sucesso!`;
      
      this.employeeName = '';
      this.capturedDescriptor = null;
      
      await this.loadData(); // Atualiza a lista
      
      setTimeout(() => {
        this.savedMessage = '';
      }, 4000);
    } catch (error) {
      console.error("Erro ao salvar no Firebase:", error);
      alert("Erro ao salvar dados.");
    } finally {
      this.saving = false;
    }
  }

  resetCapture() {
    this.capturedDescriptor = null;
  }

  async logout() {
    await this.firebaseService.logout();
    this.router.navigate(['/login']);
  }
}
