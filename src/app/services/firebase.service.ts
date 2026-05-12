import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';

const firebaseConfig = {
  apiKey: "AIzaSyDhY7R8Iqm9tAEyQTx1vX98dqvyngu6pag",
  authDomain: "ponto-facial-ba2a2.firebaseapp.com",
  projectId: "ponto-facial-ba2a2",
  storageBucket: "ponto-facial-ba2a2.firebasestorage.app",
  messagingSenderId: "99226699395",
  appId: "1:99226699395:web:15b5eac45193de7dc33db6"
};

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app = initializeApp(firebaseConfig);
  private db = getFirestore(this.app);
  private auth = getAuth(this.app);

  currentUser = new BehaviorSubject<User | null>(null);

  constructor() {
    // Garante que a sessão seja infinita no dispositivo
    setPersistence(this.auth, browserLocalPersistence);
    
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.next(user);
    });
  }

  // --- AUTHENTICATION ---
  login(email: string, pass: string) {
    return signInWithEmailAndPassword(this.auth, email, pass);
  }

  logout() {
    return signOut(this.auth);
  }

  get isLoggedIn(): boolean {
    return this.currentUser.value !== null;
  }

  get isAdmin(): boolean {
    const user = this.currentUser.value;
    if (!user || !user.email) return false;
    return user.email.toLowerCase().startsWith('admin');
  }

  get kioskLocation(): string {
    const user = this.currentUser.value;
    if (!user || !user.email) return 'Desconhecido';
    
    const email = user.email.toLowerCase();
    if (email.startsWith('balcao')) return 'Balcão';
    if (email.startsWith('cozinha')) return 'Cozinha';
    if (email.startsWith('admin')) return 'Painel Admin';
    return 'Outro';
  }

  // --- DATABASE ---
  async saveEmployee(name: string, descriptor: number[]) {
    const employeesCol = collection(this.db, 'employees');
    await addDoc(employeesCol, {
      name,
      descriptor,
      createdAt: serverTimestamp()
    });
  }

  async getEmployees() {
    const employeesCol = collection(this.db, 'employees');
    const snapshot = await getDocs(employeesCol);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'],
      descriptor: doc.data()['descriptor'] as number[]
    }));
  }

  async registerClockIn(employeeId: string, employeeName: string) {
    const logsCol = collection(this.db, 'logs');
    await addDoc(logsCol, {
      employeeId,
      employeeName,
      location: this.kioskLocation,
      timestamp: serverTimestamp()
    });
  }

  async getLogs() {
    const logsCol = collection(this.db, 'logs');
    const q = query(logsCol, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        employeeName: data['employeeName'],
        location: data['location'] || 'N/A',
        timestamp: data['timestamp']?.toDate() || new Date()
      };
    });
  }
}

