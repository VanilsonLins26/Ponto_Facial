import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { getAuth } from 'firebase/auth';

export const authGuard: CanActivateFn = async (route, state) => {
  const firebaseService = inject(FirebaseService);
  const router = inject(Router);

  // Aguarda a inicialização do Firebase no primeiro carregamento
  await firebaseService.authStateReady;
  
  // Pega o estado atual e síncrono do Firebase
  const auth = getAuth();
  
  if (auth.currentUser) {
    if (auth.currentUser.email === 'admin@admin.com' && state.url === '/') {
      return router.createUrlTree(['/admin']);
    }
    return true;
  }
  
  return router.createUrlTree(['/login']);
};
