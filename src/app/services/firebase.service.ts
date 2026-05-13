import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
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
  
  private authStateInitialized = false;
  private resolveAuthState!: (user: User | null) => void;
  public authStateReady = new Promise<User | null>((resolve) => {
    this.resolveAuthState = resolve;
  });

  constructor() {
    // Garante que a sessão seja infinita no dispositivo
    setPersistence(this.auth, browserLocalPersistence);
    
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.next(user);
      
      if (!this.authStateInitialized) {
        this.authStateInitialized = true;
        this.resolveAuthState(user);
      }
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

  async registerClockIn(employeeId: string, employeeName: string): Promise<{status: string, time: string}> {
    const logsCol = collection(this.db, 'logs');
    
    // Pega a data de hoje formatada (ex: "12/05/2026")
    const today = new Date();
    const dateString = today.toLocaleDateString('pt-BR');
    const timeString = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Busca quantos pontos o funcionário já bateu HOJE
    // Usamos dateString para evitar necessidade de criar Índice Composto no Firebase
    const qCount = query(
      logsCol, 
      where('employeeId', '==', employeeId),
      where('dateString', '==', dateString)
    );
    
    const snapshot = await getDocs(qCount);
    const punchCount = snapshot.size;

    let status = 'Extra';
    if (punchCount === 0) status = 'Entrada';
    else if (punchCount === 1) status = 'Saída Almoço';
    else if (punchCount === 2) status = 'Retorno Almoço';
    else if (punchCount === 3) status = 'Saída';

    await addDoc(logsCol, {
      employeeId,
      employeeName,
      location: this.kioskLocation,
      timestamp: serverTimestamp(),
      dateString,
      status
    });

    return { status, time: timeString };
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
        status: data['status'] || 'Entrada',
        timestamp: data['timestamp']?.toDate() || new Date()
      };
    });
  }
}

