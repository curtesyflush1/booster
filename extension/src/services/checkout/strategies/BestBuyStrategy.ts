import { CheckoutStrategy, LoginSelectors, ShippingSelectors, PaymentSelectors } from '../CheckoutStrategy';
import { DOMHelper } from '../DOMHelper';

export class BestBuyStrategy implements CheckoutStrategy {
  private domHelper = new DOMHelper();

  getLoginUrl(): string {
    return 'https://www.bestbuy.com/identity/signin';
  }

  getLoginSelectors(): LoginSelectors {
    return {
      username: '#fld-e',
      password: '#fld-p1',
      submitButton: '.cia-form__controls button[type="submit"]'
    };
  }

  getShippingSelectors(): ShippingSelectors {
    return {
      firstName: '[name="firstName"]',
      lastName: '[name="lastName"]',
      street: '[name="street"]',
      city: '[name="city"]',
      state: '[name="state"]',
      zipCode: '[name="zipCode"]'
    };
  }

  getPaymentSelectors(): PaymentSelectors {
    return {
      section: '.payment-section'
    };
  }

  getPlaceOrderSelector(): string {
    return '.btn-primary[data-track="Place Order"]';
  }

  async findAddToCartButton(): Promise<Element | null> {
    const selectors = [
      '.add-to-cart-button',
      '.btn-primary[data-track="Add to Cart"]'
    ];
    
    for (const selector of selectors) {
      const element = await this.domHelper.findElement(selector, 2000);
      if (element) return element;
    }
    
    return null;
  }

  async setQuantity(quantity: number): Promise<void> {
    const quantitySelector = '[data-testid="quantity-input"], .quantity-input';
    const element = await this.domHelper.findElement(quantitySelector);
    
    if (element) {
      await this.domHelper.fillField(element, quantity.toString());
    }
  }

  async selectExpeditedShipping(): Promise<void> {
    const expeditedSelectors = [
      '[data-testid="expedited-shipping"]',
      '.shipping-option[data-speed="expedited"]'
    ];
    
    for (const selector of expeditedSelectors) {
      const element = await this.domHelper.findElement(selector, 2000);
      if (element) {
        (element as HTMLElement).click();
        break;
      }
    }
  }
}