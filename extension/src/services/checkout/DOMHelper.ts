// Separate DOM manipulation concerns
export class DOMHelper {
  async findElement(selector: string, timeout: number = 5000): Promise<Element | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          resolve(null);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }

  async fillField(element: Element, value: string): Promise<void> {
    const input = element as HTMLInputElement;
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await this.delay(100);
  }

  async fillFieldBySelector(selector: string, value: string): Promise<void> {
    const element = await this.findElement(selector);
    if (element) {
      await this.fillField(element, value);
    }
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });
  }
}