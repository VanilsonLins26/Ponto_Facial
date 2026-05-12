import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { map, take } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const firebaseService = inject(FirebaseService);
  const router = inject(Router);

  return firebaseService.currentUser.pipe(
    take(1),
    map(user => {
      if (user && firebaseService.isAdmin) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};
