// Form autofill service for BoosterBeacon browser extension
// Handles automatic filling of shipping and payment forms during checkout

import { 
  Address, 
  PaymentMethod, 
  RetailerId,
  STORAGE_KEYS
} from '../shared/types';
import { 
  getStorageData, 
  log, 
  getCurrentRetailer 
} from '../shared/utils';

export interface AutofillData {
  shippingAddress: Address;
  billingAddress?: Address;
  paymentMethod: PaymentMethod;
  contactInfo: {
    email: string;
    phone: string;
  };
  preferences: {
    savePaymentMethod: boolean;
    createAccount: boolean;
    subscribeToNewsletter: boolean;
  };
}

export interface FormField {
  selector: string;
  value: string;
  type: 'text' | 'select' | 'checkbox' | 'radio';
  required: boolean;
}

export interface AutofillResult {
  success: boolean;
  fieldsProcessed: number;
  fieldsFilled: number;
  errors: string[];
}

export class FormAutofillService {
  private retailerId: RetailerId;
  private autofillData: AutofillData | null = null;

  constructor(retailerId: RetailerId) {
    this.retailerId = retailerId;
  }

  /**
   * Initialize the autofill service with user data
   */
  async initialize(): Promise<void> {
    this.autofillData = await getStorageData<AutofillData>(`${STORAGE_KEYS.PREFERENCES}_autofill`);
    
    if (!this.autofillData) {
      throw new Error('Autofill data not configured');
    }
    
    log('info', `Form autofill service initialized for ${this.retailerId}`);
  }

  /**
   * Auto-fill shipping information form
   */
  async fillShippingForm(): Promise<AutofillResult> {
    if (!this.autofillData?.shippingAddress) {
      throw new Error('Shipping address not configured');
    }

    const fields = this.getShippingFormFields(this.autofillData.shippingAddress);
    return this.fillFormFields(fields, 'shipping');
  }

  /**
   * Auto-fill billing information form
   */
  async fillBillingForm(): Promise<AutofillResult> {
    const billingAddress = this.autofillData?.billingAddress || this.autofillData?.shippingAddress;
    
    if (!billingAddress) {
      throw new Error('Billing address not configured');
    }

    const fields = this.getBillingFormFields(billingAddress);
    return this.fillFormFields(fields, 'billing');
  }

  /**
   * Auto-fill contact information form
   */
  async fillContactForm(): Promise<AutofillResult> {
    if (!this.autofillData?.contactInfo) {
      throw new Error('Contact information not configured');
    }

    const fields = this.getContactFormFields(this.autofillData.contactInfo);
    return this.fillFormFields(fields, 'contact');
  }

  /**
   * Auto-fill payment method form (limited for security)
   */
  async fillPaymentForm(): Promise<AutofillResult> {
    if (!this.autofillData?.paymentMethod) {
      throw new Error('Payment method not configured');
    }

    // For security reasons, we only fill non-sensitive payment fields
    const fields = this.getPaymentFormFields(this.autofillData.paymentMethod);
    return this.fillFormFields(fields, 'payment');
  }

  /**
   * Auto-fill all available forms on the current page
   */
  async fillAllForms(): Promise<{ [key: string]: AutofillResult }> {
    const results: { [key: string]: AutofillResult } = {};

    try {
      // Try to fill shipping form
      if (this.isShippingFormPresent()) {
        results.shipping = await this.fillShippingForm();
      }

      // Try to fill billing form
      if (this.isBillingFormPresent()) {
        results.billing = await this.fillBillingForm();
      }

      // Try to fill contact form
      if (this.isContactFormPresent()) {
        results.contact = await this.fillContactForm();
      }

      // Try to fill payment form (limited)
      if (this.isPaymentFormPresent()) {
        results.payment = await this.fillPaymentForm();
      }

    } catch (error) {
      log('error', 'Error during form autofill', error);
    }

    return results;
  }

  /**
   * Fill form fields with provided data
   */
  private async fillFormFields(fields: FormField[], formType: string): Promise<AutofillResult> {
    const result: AutofillResult = {
      success: true,
      fieldsProcessed: 0,
      fieldsFilled: 0,
      errors: []
    };

    log('info', `Filling ${formType} form with ${fields.length} fields`);

    for (const field of fields) {
      result.fieldsProcessed++;

      try {
        const element = document.querySelector(field.selector) as HTMLElement;
        
        if (!element) {
          if (field.required) {
            result.errors.push(`Required field not found: ${field.selector}`);
            result.success = false;
          }
          continue;
        }

        const filled = await this.fillField(element, field);
        if (filled) {
          result.fieldsFilled++;
        }

      } catch (error) {
        const errorMsg = `Failed to fill field ${field.selector}: ${error}`;
        result.errors.push(errorMsg);
        log('error', errorMsg);
        
        if (field.required) {
          result.success = false;
        }
      }
    }

    log('info', `${formType} form fill completed: ${result.fieldsFilled}/${result.fieldsProcessed} fields filled`);
    return result;
  }

  /**
   * Fill a single form field based on its type
   */
  private async fillField(element: HTMLElement, field: FormField): Promise<boolean> {
    switch (field.type) {
      case 'text':
        return this.fillTextInput(element as HTMLInputElement, field.value);
      
      case 'select':
        return this.fillSelectField(element as HTMLSelectElement, field.value);
      
      case 'checkbox':
        return this.fillCheckboxField(element as HTMLInputElement, field.value === 'true');
      
      case 'radio':
        return this.fillRadioField(element as HTMLInputElement, field.value);
      
      default:
        log('warn', `Unknown field type: ${field.type}`);
        return false;
    }
  }

  /**
   * Fill text input field
   */
  private async fillTextInput(input: HTMLInputElement, value: string): Promise<boolean> {
    if (input.value && input.value.trim() !== '') {
      // Field already has a value, skip it
      return false;
    }

    // Focus the field
    input.focus();
    
    // Clear existing value
    input.value = '';
    
    // Type the value character by character to simulate human input
    for (const char of value) {
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(50); // Small delay between characters
    }
    
    // Trigger change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    
    return true;
  }

  /**
   * Fill select dropdown field
   */
  private async fillSelectField(select: HTMLSelectElement, value: string): Promise<boolean> {
    // Try to find option by value
    let option = select.querySelector(`option[value="${value}"]`) as HTMLOptionElement;
    
    // If not found, try to find by text content
    if (!option) {
      const options = Array.from(select.options);
      option = options.find(opt => 
        opt.textContent?.toLowerCase().includes(value.toLowerCase())
      ) as HTMLOptionElement;
    }
    
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }

  /**
   * Fill checkbox field
   */
  private async fillCheckboxField(checkbox: HTMLInputElement, checked: boolean): Promise<boolean> {
    if (checkbox.checked !== checked) {
      checkbox.checked = checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /**
   * Fill radio button field
   */
  private async fillRadioField(radio: HTMLInputElement, value: string): Promise<boolean> {
    if (radio.value === value && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /**
   * Get shipping form fields for the current retailer
   */
  private getShippingFormFields(address: Address): FormField[] {
    const baseFields: FormField[] = [
      { selector: '', value: address.firstName, type: 'text', required: true },
      { selector: '', value: address.lastName, type: 'text', required: true },
      { selector: '', value: address.street, type: 'text', required: true },
      { selector: '', value: address.city, type: 'text', required: true },
      { selector: '', value: address.state, type: 'select', required: true },
      { selector: '', value: address.zipCode, type: 'text', required: true },
      { selector: '', value: address.country, type: 'select', required: true }
    ];

    // Apply retailer-specific selectors
    const selectors = this.getRetailerSelectors().shipping;
    baseFields[0].selector = selectors.firstName;
    baseFields[1].selector = selectors.lastName;
    baseFields[2].selector = selectors.street;
    baseFields[3].selector = selectors.city;
    baseFields[4].selector = selectors.state;
    baseFields[5].selector = selectors.zipCode;
    baseFields[6].selector = selectors.country;

    return baseFields;
  }

  /**
   * Get billing form fields for the current retailer
   */
  private getBillingFormFields(address: Address): FormField[] {
    const baseFields: FormField[] = [
      { selector: '', value: address.firstName, type: 'text', required: true },
      { selector: '', value: address.lastName, type: 'text', required: true },
      { selector: '', value: address.street, type: 'text', required: true },
      { selector: '', value: address.city, type: 'text', required: true },
      { selector: '', value: address.state, type: 'select', required: true },
      { selector: '', value: address.zipCode, type: 'text', required: true },
      { selector: '', value: address.country, type: 'select', required: true }
    ];

    // Apply retailer-specific selectors
    const selectors = this.getRetailerSelectors().billing;
    baseFields[0].selector = selectors.firstName;
    baseFields[1].selector = selectors.lastName;
    baseFields[2].selector = selectors.street;
    baseFields[3].selector = selectors.city;
    baseFields[4].selector = selectors.state;
    baseFields[5].selector = selectors.zipCode;
    baseFields[6].selector = selectors.country;

    return baseFields;
  }

  /**
   * Get contact form fields for the current retailer
   */
  private getContactFormFields(contactInfo: { email: string; phone: string }): FormField[] {
    const selectors = this.getRetailerSelectors().contact;
    
    return [
      { selector: selectors.email, value: contactInfo.email, type: 'text', required: true },
      { selector: selectors.phone, value: contactInfo.phone, type: 'text', required: false }
    ];
  }

  /**
   * Get payment form fields (non-sensitive only)
   */
  private getPaymentFormFields(paymentMethod: PaymentMethod): FormField[] {
    const selectors = this.getRetailerSelectors().payment;
    const fields: FormField[] = [];

    // Only fill non-sensitive payment information
    if (paymentMethod.expiryMonth && paymentMethod.expiryYear) {
      fields.push(
        { selector: selectors.expiryMonth, value: paymentMethod.expiryMonth.toString().padStart(2, '0'), type: 'select', required: true },
        { selector: selectors.expiryYear, value: paymentMethod.expiryYear.toString(), type: 'select', required: true }
      );
    }

    // Add cardholder name if available (assuming it matches billing name)
    if (this.autofillData?.billingAddress || this.autofillData?.shippingAddress) {
      const address = this.autofillData.billingAddress || this.autofillData.shippingAddress;
      const cardholderName = `${address.firstName} ${address.lastName}`;
      fields.push({ selector: selectors.cardholderName, value: cardholderName, type: 'text', required: false });
    }

    return fields;
  }

  /**
   * Get retailer-specific form selectors
   */
  private getRetailerSelectors() {
    const selectors = {
      bestbuy: {
        shipping: {
          firstName: '[name="firstName"], #firstName',
          lastName: '[name="lastName"], #lastName',
          street: '[name="street"], #street',
          city: '[name="city"], #city',
          state: '[name="state"], #state',
          zipCode: '[name="zipCode"], #zipCode',
          country: '[name="country"], #country'
        },
        billing: {
          firstName: '[name="billingFirstName"], #billingFirstName',
          lastName: '[name="billingLastName"], #billingLastName',
          street: '[name="billingStreet"], #billingStreet',
          city: '[name="billingCity"], #billingCity',
          state: '[name="billingState"], #billingState',
          zipCode: '[name="billingZipCode"], #billingZipCode',
          country: '[name="billingCountry"], #billingCountry'
        },
        contact: {
          email: '[name="email"], #email',
          phone: '[name="phone"], #phone'
        },
        payment: {
          cardholderName: '[name="cardholderName"], #cardholderName',
          expiryMonth: '[name="expiryMonth"], #expiryMonth',
          expiryYear: '[name="expiryYear"], #expiryYear'
        }
      },
      walmart: {
        shipping: {
          firstName: '[name="firstName"], [data-testid="firstName"]',
          lastName: '[name="lastName"], [data-testid="lastName"]',
          street: '[name="addressLineOne"], [data-testid="addressLineOne"]',
          city: '[name="city"], [data-testid="city"]',
          state: '[name="state"], [data-testid="state"]',
          zipCode: '[name="postalCode"], [data-testid="postalCode"]',
          country: '[name="country"], [data-testid="country"]'
        },
        billing: {
          firstName: '[name="billingFirstName"]',
          lastName: '[name="billingLastName"]',
          street: '[name="billingAddressLineOne"]',
          city: '[name="billingCity"]',
          state: '[name="billingState"]',
          zipCode: '[name="billingPostalCode"]',
          country: '[name="billingCountry"]'
        },
        contact: {
          email: '[name="email"], [data-testid="email"]',
          phone: '[name="phone"], [data-testid="phone"]'
        },
        payment: {
          cardholderName: '[name="cardholderName"]',
          expiryMonth: '[name="month"]',
          expiryYear: '[name="year"]'
        }
      },
      costco: {
        shipping: {
          firstName: '[name="firstName"]',
          lastName: '[name="lastName"]',
          street: '[name="address1"]',
          city: '[name="city"]',
          state: '[name="state"]',
          zipCode: '[name="zipCode"]',
          country: '[name="country"]'
        },
        billing: {
          firstName: '[name="billingFirstName"]',
          lastName: '[name="billingLastName"]',
          street: '[name="billingAddress1"]',
          city: '[name="billingCity"]',
          state: '[name="billingState"]',
          zipCode: '[name="billingZipCode"]',
          country: '[name="billingCountry"]'
        },
        contact: {
          email: '[name="email"]',
          phone: '[name="phone"]'
        },
        payment: {
          cardholderName: '[name="cardholderName"]',
          expiryMonth: '[name="expiryMonth"]',
          expiryYear: '[name="expiryYear"]'
        }
      },
      samsclub: {
        shipping: {
          firstName: '[name="firstName"], [data-testid="firstName"]',
          lastName: '[name="lastName"], [data-testid="lastName"]',
          street: '[name="addressLine1"], [data-testid="addressLine1"]',
          city: '[name="city"], [data-testid="city"]',
          state: '[name="state"], [data-testid="state"]',
          zipCode: '[name="zipCode"], [data-testid="zipCode"]',
          country: '[name="country"], [data-testid="country"]'
        },
        billing: {
          firstName: '[name="billingFirstName"]',
          lastName: '[name="billingLastName"]',
          street: '[name="billingAddressLine1"]',
          city: '[name="billingCity"]',
          state: '[name="billingState"]',
          zipCode: '[name="billingZipCode"]',
          country: '[name="billingCountry"]'
        },
        contact: {
          email: '[name="email"], [data-testid="email"]',
          phone: '[name="phone"], [data-testid="phone"]'
        },
        payment: {
          cardholderName: '[name="cardholderName"]',
          expiryMonth: '[name="expiryMonth"]',
          expiryYear: '[name="expiryYear"]'
        }
      }
    };

    return selectors[this.retailerId];
  }

  // Form detection methods

  private isShippingFormPresent(): boolean {
    const selectors = this.getRetailerSelectors().shipping;
    return !!(document.querySelector(selectors.firstName) || document.querySelector(selectors.street));
  }

  private isBillingFormPresent(): boolean {
    const selectors = this.getRetailerSelectors().billing;
    return !!(document.querySelector(selectors.firstName) || document.querySelector(selectors.street));
  }

  private isContactFormPresent(): boolean {
    const selectors = this.getRetailerSelectors().contact;
    return !!(document.querySelector(selectors.email));
  }

  private isPaymentFormPresent(): boolean {
    const selectors = this.getRetailerSelectors().payment;
    return !!(document.querySelector(selectors.expiryMonth) || document.querySelector(selectors.cardholderName));
  }

  /**
   * Utility method for delays
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save autofill data for future use
   */
  static async saveAutofillData(data: AutofillData): Promise<void> {
    await setStorageData(`${STORAGE_KEYS.PREFERENCES}_autofill`, data);
    log('info', 'Autofill data saved');
  }

  /**
   * Get saved autofill data
   */
  static async getAutofillData(): Promise<AutofillData | null> {
    return getStorageData<AutofillData>(`${STORAGE_KEYS.PREFERENCES}_autofill`);
  }
}