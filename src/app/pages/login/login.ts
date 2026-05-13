import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email: string = '';
  pass: string = '';
  errorMessage: string = '';
  loading = false;

  constructor(
    private firebaseService: FirebaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async onLogin() {
    if (!this.email || !this.pass) return;

    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    try {
      const cred = await this.firebaseService.login(this.email, this.pass);
      
      // Força a atualização síncrona para que os Guards leiam corretamente sem atraso
      this.firebaseService.currentUser.next(cred.user);

      // Redirecionamento Inteligente baseado no Papel lendo diretamente do email autenticado
      if (cred.user.email === 'admin@admin.com') {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/']);
      }

    } catch (error: any) {
      this.errorMessage = "Credenciais inválidas. Verifique seu e-mail e senha.";
      console.error(error);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}

