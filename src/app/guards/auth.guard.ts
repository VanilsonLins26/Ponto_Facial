import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = async (route, state) => {
  const firebaseService = inject(FirebaseService);
  const router = inject(Router);

  const user = await firebaseService.authStateReady;
  
  if (user) {
    return true;
  }
  
  return router.createUrlTree(['/login']);
};
