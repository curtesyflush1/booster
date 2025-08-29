// Proposed refactored structure for ContentScript
// This demonstrates how to break down the large ContentScript class

interface IUIManager {
  injectFloatingButton(): void;
  injectProductUI(product: Product): void;
  showNotification(message: string, type: 'success' | 'error' | 'info'): void;
  showQuickActions(): void;
}

interface IMessageHandler {
  handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): boolean;
}

interface IServiceCoordinator {
  initializeServices(): Promise<void>;
  executeAddToCart(payload: any): Promise<MessageResponse>;
  fillCheckoutForm(payload: any): Promise<MessageResponse>;
  executeAutomatedCheckout(payload: any): Promise<MessageResponse>;
}

// Focused UI Management Class
class UIManager implements IUIManager {
  constructor(
    private retailer: { id: RetailerId; name: string } | null,
    private productDetector: ProductDetector | null,
    private onAddToWatchList: (product: Product) => Promise<void>,
    private onQuickBuy: (product: Product) => Promise<void>
  ) {}

  injectFloatingButton(): void {
    const existingButton = document.getElementById('booster-beacon-fab');
    if (existingButton) return;
    
    const fab = document.createElement('div');
    fab.id = 'booster-beacon-fab';
    fab.className = 'booster-beacon-fab';
    fab.innerHTML = `
      <div class="bb-fab-icon">🔔</div>
      <div class="bb-fab-tooltip">BoosterBeacon</div>
    `;
    
    fab.addEventListener('click', () => this.showQuickActions());
    document.body.appendChild(fab);
  }

  injectProductUI(product: Product): void {
    // Focused product UI injection logic
    const productUI = this.createProductUI(product);
    this.positionProductUI(productUI);
    this.setupProductUIEvents(productUI, product);
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `bb-notification bb-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  showQuickActions(): void {
    // Focused quick actions menu logic
  }

  private createProductUI(product: Product): HTMLElement {
    // Extract product UI creation logic
    const productUI = document.createElement('div');
    // ... UI creation logic
    return productUI;
  }

  private positionProductUI(ui: HTMLElement): void {
    // Extract positioning logic
    const productContainer = this.findProductContainer();
    if (productContainer) {
      productContainer.appendChild(ui);
    } else {
      document.body.appendChild(ui);
    }
  }

  private findProductContainer(): Element | null {
    const selectors = {
      bestbuy: '.pricing-price__range, .sr-product-details',
      walmart: '.price-group, .product-details',
      costco: '.product-price, .product-info-main',
      samsclub: '.price, .product-details'
    };
    
    const selector = selectors[this.retailer?.id as keyof typeof selectors];
    return selector ? document.querySelector(selector) : null;
  }

  private setupProductUIEvents(ui: Element, product: Product): void {
    const addWatchBtn = ui.querySelector('#bb-add-watch');
    const quickBuyBtn = ui.querySelector('#bb-quick-buy');
    const closeBtn = ui.querySelector('.bb-close-btn');
    
    addWatchBtn?.addEventListener('click', () => this.onAddToWatchList(product));
    quickBuyBtn?.addEventListener('click', () => this.onQuickBuy(product));
    closeBtn?.addEventListener('click', () => ui.remove());
  }
}

// Focused Message Handler Class
class MessageHandler implements IMessageHandler {
  constructor(private serviceCoordinator: IServiceCoordinator) {}

  handleMessage(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    log('info', `Content script received message: ${message.type}`);
    
    const messageHandlers = {
      [MessageType.PING]: () => sendResponse({ success: true, data: 'pong' }),
      [MessageType.EXECUTE_ADD_TO_CART]: () => this.handleAsyncMessage(
        () => this.serviceCoordinator.executeAddToCart(message.payload),
        sendResponse,
        'EXECUTION_ERROR'
      ),
      [MessageType.FILL_CHECKOUT_FORM]: () => this.handleAsyncMessage(
        () => this.serviceCoordinator.fillCheckoutForm(message.payload),
        sendResponse,
        'FORM_FILL_ERROR'
      ),
      'EXECUTE_AUTOMATED_CHECKOUT': () => this.handleAsyncMessage(
        () => this.serviceCoordinator.executeAutomatedCheckout(message.payload),
        sendResponse,
        'CHECKOUT_ERROR'
      )
    };

    const handler = messageHandlers[message.type as keyof typeof messageHandlers];
    if (handler) {
      handler();
      return message.type !== MessageType.PING; // Return true for async handlers
    }

    sendResponse({ 
      success: false, 
      error: { code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unknown message type' } 
    });
    return false;
  }

  private handleAsyncMessage(
    asyncHandler: () => Promise<MessageResponse>,
    sendResponse: (response: MessageResponse) => void,
    errorCode: string
  ): void {
    asyncHandler()
      .then(sendResponse)
      .catch(error => sendResponse({ 
        success: false, 
        error: { code: errorCode, message: error.message } 
      }));
  }
}

// Refactored ContentScript as Orchestrator
class ContentScript {
  private retailer = getCurrentRetailer();
  private productDetector: ProductDetector | null = null;
  private checkoutAssistant: CheckoutAssistant | null = null;
  private uiManager: IUIManager | null = null;
  private messageHandler: IMessageHandler | null = null;
  private serviceCoordinator: IServiceCoordinator | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized || !this.retailer) return;
    
    log('info', `Content script initializing on ${this.retailer.name}`);
    
    // Initialize components
    this.productDetector = new ProductDetector(this.retailer.id);
    this.checkoutAssistant = new CheckoutAssistant(this.retailer.id);
    this.serviceCoordinator = new ServiceCoordinator(/* dependencies */);
    this.uiManager = new UIManager(
      this.retailer,
      this.productDetector,
      this.addProductToWatchList.bind(this),
      this.executeQuickBuy.bind(this)
    );
    this.messageHandler = new MessageHandler(this.serviceCoordinator);
    
    // Set up message listener
    chrome.runtime.onMessage.addListener(this.messageHandler.handleMessage.bind(this.messageHandler));
    
    // Initialize services and start monitoring
    await this.serviceCoordinator.initializeServices();
    this.startPageMonitoring();
    this.injectUI();
    
    this.isInitialized = true;
    log('info', 'Content script initialized successfully');
  }

  private startPageMonitoring(): void {
    this.productDetector?.startMonitoring();
    this.checkoutAssistant?.startMonitoring();
    this.trackPageView();
  }

  private injectUI(): void {
    this.uiManager?.injectFloatingButton();
    if (this.productDetector?.isProductPage()) {
      const product = this.productDetector.detectProduct();
      if (product) {
        this.uiManager?.injectProductUI(product);
      }
    }
  }

  private async addProductToWatchList(product: Product): Promise<void> {
    // Focused watch list logic
  }

  private async executeQuickBuy(product: Product): Promise<void> {
    // Focused quick buy logic
  }

  private async trackPageView(): Promise<void> {
    // Page view tracking logic
  }
}