import { Injectable, OnModuleInit } from "@nestjs/common";

// Global execution state interface
export interface ActiveExecution {
  taskId: string;
  taskTitle: string;
  agentType: string;
  projectId: string;
  projectName: string;
  status: 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: number;
  currentStep: string;
}

@Injectable()
export class ExecutionStateService implements OnModuleInit {
  private activeExecutions: Map<string, ActiveExecution> = new Map();

  constructor() {}

  onModuleInit() {
    console.log('[ExecutionState] Execution state service initialized');
  }

  // Start tracking an execution
  startExecution(params: {
    taskId: string;
    taskTitle: string;
    agentType: string;
    projectId: string;
    projectName: string;
    currentStep: string;
  }) {
    const key = params.taskId;
    const execution: ActiveExecution = {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      agentType: params.agentType,
      projectId: params.projectId,
      projectName: params.projectName,
      status: 'RUNNING',
      startedAt: Date.now(),
      currentStep: params.currentStep,
    };
    this.activeExecutions.set(key, execution);
    console.log(`[ExecutionState] Started tracking: ${params.taskTitle}`);
  }

  // Update execution step
  updateStep(taskId: string, currentStep: string) {
    const execution = this.activeExecutions.get(taskId);
    if (execution) {
      execution.currentStep = currentStep;
    }
  }

  // Complete an execution
  completeExecution(taskId: string, status: 'DONE' | 'ERROR' = 'DONE') {
    const execution = this.activeExecutions.get(taskId);
    if (execution) {
      execution.status = status;
      setTimeout(() => {
        this.activeExecutions.delete(taskId);
        console.log(`[ExecutionState] Removed completed: ${execution.taskTitle}`);
      }, 5000); // Keep for 5s for visibility
    }
  }

  // Get all active executions
  getActiveExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  // Get active count
  getActiveCount(): number {
    return this.activeExecutions.size;
  }

  // Clear all (for testing)
  clearAll() {
    this.activeExecutions.clear();
  }
}
