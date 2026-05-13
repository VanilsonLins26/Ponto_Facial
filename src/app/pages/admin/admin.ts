import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Camera } from '../../components/camera/camera';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../services/firebase.service';
import { Router, RouterModule } from '@angular/router';
import * as faceapi from 'face-api.js';

interface WorkReport {
  date: string;
  employeeName: string;
  in?: Date;
  lunchOut?: Date;
  lunchIn?: Date;
  out?: Date;
  totalWorkedMs: number;
  totalWorkedFormatted: string;
  statusText: string;
}

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
  showCadastro: boolean = false;
  
  employees: any[] = [];
  logs: any[] = [];
  reports: WorkReport[] = [];

  // Modal State
  selectedEmployeeForReport: string | null = null;
  employeeReports: WorkReport[] = [];
  filteredEmployeeReports: WorkReport[] = [];
  employeeTotalHours: string = '';
  
  availableWeeks: any[] = [];
  selectedWeekIndex: number = 0;

  constructor(
    private firebaseService: FirebaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.employees = await this.firebaseService.getEmployees();
      this.logs = await this.firebaseService.getLogs();
      this.generateReport();
      this.cdr.detectChanges();
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    }
  }

  generateReport() {
    // Agrupar logs por data e funcionário
    const groups: { [key: string]: any } = {};

    this.logs.forEach(log => {
      // Como o Firebase salva `dateString`, vamos extrair do próprio timestamp para ter certeza
      const dateStr = log.timestamp.toLocaleDateString('pt-BR');
      const empName = log.employeeName;
      const key = `${dateStr}_${empName}`;

      if (!groups[key]) {
        groups[key] = {
          date: dateStr,
          employeeName: empName,
          logs: []
        };
      }
      groups[key].logs.push(log);
    });

    const newReports: WorkReport[] = [];

    // Calcular horários para cada grupo
    Object.values(groups).forEach(group => {
      // Ordenar do mais antigo pro mais novo no dia
      const dayLogs = group.logs.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const report: WorkReport = {
        date: group.date,
        employeeName: group.employeeName,
        totalWorkedMs: 0,
        totalWorkedFormatted: '00h 00m',
        statusText: 'Falta Ponto'
      };

      // Tentar identificar as batidas
      dayLogs.forEach((log: any) => {
        if (log.status === 'Entrada') report.in = log.timestamp;
        else if (log.status === 'Saída Almoço') report.lunchOut = log.timestamp;
        else if (log.status === 'Retorno Almoço') report.lunchIn = log.timestamp;
        else if (log.status === 'Saída') report.out = log.timestamp;
      });

      // Se o Firebase ainda não tinha status salvo (logs antigos), usamos a ordem:
      if (!report.in && dayLogs[0]) report.in = dayLogs[0].timestamp;
      if (!report.lunchOut && dayLogs[1]) report.lunchOut = dayLogs[1].timestamp;
      if (!report.lunchIn && dayLogs[2]) report.lunchIn = dayLogs[2].timestamp;
      if (!report.out && dayLogs[3]) report.out = dayLogs[3].timestamp;

      // Calcular tempo total
      let msWorked = 0;
      
      if (report.in && report.out) {
        // Trabalhou os 4 turnos (Entrada -> Almoço -> Retorno -> Saída)
        if (report.lunchOut && report.lunchIn) {
          const firstPeriod = report.lunchOut.getTime() - report.in.getTime();
          const secondPeriod = report.out.getTime() - report.lunchIn.getTime();
          msWorked = firstPeriod + secondPeriod;
          report.statusText = 'Completo';
        } 
        // Bateu apenas Entrada e Saída (sem almoço registrado)
        else {
          msWorked = report.out.getTime() - report.in.getTime();
          report.statusText = 'Sem Almoço';
        }
      } else if (report.in && report.lunchOut) {
        msWorked = report.lunchOut.getTime() - report.in.getTime();
        report.statusText = 'Em Almoço';
      } else if (report.in && !report.out) {
        report.statusText = 'Trabalhando';
      }

      if (msWorked > 0) {
        report.totalWorkedMs = msWorked;
        const totalMinutes = Math.floor(msWorked / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        report.totalWorkedFormatted = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
      } else if (report.statusText === 'Falta Ponto' || report.statusText === 'Trabalhando') {
        report.totalWorkedFormatted = '--h --m';
      }

      newReports.push(report);
    });

    // Ordenar por data mais recente
    this.reports = newReports.sort((a, b) => {
      // Converte DD/MM/YYYY para YYYY-MM-DD para comparar datas corretamente
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return dateB.localeCompare(dateA);
    });
  }

  onFaceDetected(descriptor: Float32Array) {
    if (!this.capturedDescriptor) {
      this.capturedDescriptor = descriptor;
      this.cdr.detectChanges();
    }
  }

  async saveEmployee() {
    if (!this.employeeName || !this.capturedDescriptor || this.saving) {
      return;
    }

    this.saving = true;
    this.cdr.detectChanges();

    // Proteção Anti-Duplicidade
    if (this.employees.length > 0) {
      const labeledDescriptors = this.employees.map(emp => {
        const descriptorArray = new Float32Array(emp.descriptor);
        return new faceapi.LabeledFaceDescriptors(emp.name + "||" + emp.id, [descriptorArray]);
      });
      // Tolerância menor (0.45) para evitar falsos positivos no cadastro
      const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45); 
      const match = matcher.findBestMatch(this.capturedDescriptor);
      
      if (match.label !== 'unknown') {
        const [name] = match.label.split("||");
        alert(`Proteção Anti-Fraude: Esse rosto já está cadastrado para o(a) funcionário(a) "${name}".`);
        this.resetCapture();
        this.saving = false;
        this.cdr.detectChanges();
        return; // Impede o cadastro duplo
      }
    }

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
        this.showCadastro = false;
        this.cdr.detectChanges();
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar no Firebase:", error);
      alert("Erro ao salvar dados.");
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  resetCapture() {
    this.capturedDescriptor = null;
    this.cdr.detectChanges();
  }

  toggleCadastro() {
    this.showCadastro = !this.showCadastro;
    if (!this.showCadastro) {
      this.resetCapture();
      this.employeeName = '';
    }
  }

  async logout() {
    await this.firebaseService.logout();
    this.router.navigate(['/login']);
  }

  // --- Modal Logic ---
  openEmployeeReport(empName: string) {
    this.selectedEmployeeForReport = empName;
    this.employeeReports = this.reports.filter(r => r.employeeName === empName);
    
    // Gerar as últimas 4 semanas
    this.availableWeeks = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Encontrar a Segunda-feira da semana atual
    const dayOfWeek = today.getDay(); 
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    
    for (let i = 0; i < 4; i++) {
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), diffToMonday - (i * 7));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6); // Domingo
      
      let label = i === 0 ? 'Semana Atual' : `Semana Passada (${i})`;
      if (i > 1) label = `${i} Semanas Atrás`;

      this.availableWeeks.push({
        label: `${label} (${startOfWeek.toLocaleDateString('pt-BR').substring(0,5)} a ${endOfWeek.toLocaleDateString('pt-BR').substring(0,5)})`,
        start: startOfWeek,
        end: endOfWeek
      });
    }

    this.selectedWeekIndex = 0;
    this.updateModalData();
  }

  onWeekChange(event: any) {
    this.selectedWeekIndex = Number(event.target.value);
    this.updateModalData();
  }

  updateModalData() {
    const selectedWeek = this.availableWeeks[this.selectedWeekIndex];
    
    // Configurar as horas de fim de semana para cobrir até 23:59:59 de Domingo
    const endOfWeekLimit = new Date(selectedWeek.end);
    endOfWeekLimit.setHours(23, 59, 59, 999);

    // Filtrar os dias apenas dessa semana selecionada
    this.filteredEmployeeReports = this.employeeReports.filter(r => {
      const [d, m, y] = r.date.split('/');
      const reportDate = new Date(Number(y), Number(m) - 1, Number(d));
      return reportDate >= selectedWeek.start && reportDate <= endOfWeekLimit;
    });

    // Somar total da semana selecionada
    let totalMs = 0;
    this.filteredEmployeeReports.forEach(r => {
      totalMs += r.totalWorkedMs;
    });
    
    if (totalMs > 0) {
      const totalMinutes = Math.floor(totalMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      this.employeeTotalHours = `${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
    } else {
      this.employeeTotalHours = '00h 00m';
    }

    this.cdr.detectChanges();
  }

  closeEmployeeReport() {
    this.selectedEmployeeForReport = null;
    this.employeeReports = [];
    this.filteredEmployeeReports = [];
    this.employeeTotalHours = '';
    this.cdr.detectChanges();
  }
}
