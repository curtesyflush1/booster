import { CheckoutStep } from '../checkoutAutomation';

export class StepManager {
  private steps: CheckoutStep[] = [];

  addStep(name: string, status: CheckoutStep['status']): void {
    const step: CheckoutStep = {
      name,
      status,
      timestamp: Date.now()
    };
    this.steps.push(step);
  }

  updateStep(name: string, status: CheckoutStep['status'], error?: string): void {
    const step = this.steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      step.timestamp = Date.now();
      if (error) {
        step.error = error;
      }
    }
  }

  getCurrentStep(): CheckoutStep | null {
    return this.steps.length > 0 ? this.steps[this.steps.length - 1] : null;
  }

  getSteps(): CheckoutStep[] {
    return [...this.steps]; // Return copy to prevent mutation
  }

  markCurrentStepAsFailed(error: string): void {
    const currentStep = this.getCurrentStep();
    if (currentStep && (currentStep.status === 'in_progress' || currentStep.status === 'pending')) {
      currentStep.status = 'failed';
      currentStep.error = error;
    }
  }

  reset(): void {
    this.steps = [];
  }
}