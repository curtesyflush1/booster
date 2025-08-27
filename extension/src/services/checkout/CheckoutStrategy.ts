// Strategy pattern for retailer-specific checkout implementations
export interface CheckoutStrategy {
  getLoginUrl(): string;
  getLoginSelectors(): LoginSelectors;
  getShippingSelectors(): ShippingSelectors;
  getPaymentSelectors(): PaymentSelectors;
  getPlaceOrderSelector(): string;
  findAddToCartButton(): Promise<Element | null>;
  setQuantity(quantity: number): Promise<void>;
  selectExpeditedShipping(): Promise<void>;
}

export interface LoginSelectors {
  username: string;
  password: string;
  submitButton: string;
}

export interface ShippingSelectors {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface PaymentSelectors {
  section: string;
}