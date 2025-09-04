// Permissions management tab for BoosterBeacon extension options page

import { RetailerId, SUPPORTED_RETAILERS, MessageType } from '../shared/types';
import { sendExtensionMessage, log } from '../shared/utils';

export class PermissionsTab {
  private container: HTMLElement;
  private permissionStatuses: Map<RetailerId, boolean> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadPermissionStatuses();
    this.render();
    this.setupEventListeners();
  }

  private async loadPermissionStatuses(): Promise<void> {
    try {
      const response = await sendExtensionMessage({
        type: 'CHECK_RETAILER_PERMISSIONS' as any
      });

      if (response.success && response.data) {
        const { retailerStatuses } = response.data as { retailerStatuses: Array<{ retailerId: RetailerId; hasPermission: boolean }>; };
        
        for (const status of retailerStatuses) {
          this.permissionStatuses.set(status.retailerId, status.hasPermission);
        }
      }
    } catch (error) {
      log('error', 'Failed to load permission statuses', error);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="permissions-tab">
        <div class="permissions-header">
          <h2>Retailer Permissions</h2>
          <p class="permissions-description">
            BoosterBeacon needs permission to access retailer websites to monitor products and assist with checkout.
            You can grant or revoke permissions for individual retailers below.
          </p>
        </div>

        <div class="permissions-overview">
          <div class="permission-summary">
            <h3>Permission Status</h3>
            <div class="permission-stats">
              <div class="stat">
                <span class="stat-number" id="granted-count">0</span>
                <span class="stat-label">Granted</span>
              </div>
              <div class="stat">
                <span class="stat-number" id="total-count">${Object.keys(SUPPORTED_RETAILERS).length}</span>
                <span class="stat-label">Total</span>
              </div>
            </div>
          </div>
          
          <div class="permission-actions">
            <button id="grant-all-btn" class="btn btn-primary">Grant All Permissions</button>
            <button id="revoke-all-btn" class="btn btn-secondary">Revoke All Permissions</button>
          </div>
        </div>

        <div class="retailers-list">
          <h3>Individual Retailer Permissions</h3>
          <div class="retailers-grid" id="retailers-grid">
            ${this.renderRetailerCards()}
          </div>
        </div>

        <div class="permissions-info">
          <h3>Why These Permissions?</h3>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-icon">🔍</div>
              <div class="info-content">
                <h4>Product Detection</h4>
                <p>Automatically detect Pokémon TCG products on retailer pages and show relevant information.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">🛒</div>
              <div class="info-content">
                <h4>Checkout Assistance</h4>
                <p>Help fill shipping and payment information during checkout for faster purchases.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">💰</div>
              <div class="info-content">
                <h4>Price Monitoring</h4>
                <p>Track product prices and availability to send you timely alerts when items restock.</p>
              </div>
            </div>
            <div class="info-item">
              <div class="info-icon">🔒</div>
              <div class="info-content">
                <h4>Privacy & Security</h4>
                <p>Permissions are only used for BoosterBeacon functionality. No data is collected without your consent.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updatePermissionStats();
  }

  private renderRetailerCards(): string {
    return Object.entries(SUPPORTED_RETAILERS).map(([id, retailer]) => {
      const hasPermission = this.permissionStatuses.get(id as RetailerId) || false;
      const statusClass = hasPermission ? 'granted' : 'not-granted';
      const statusText = hasPermission ? 'Granted' : 'Not Granted';
      const buttonText = hasPermission ? 'Revoke' : 'Grant';
      const buttonClass = hasPermission ? 'btn-danger' : 'btn-primary';

      return `
        <div class="retailer-card ${statusClass}" data-retailer="${id}">
          <div class="retailer-header">
            <div class="retailer-info">
              <h4 class="retailer-name">${retailer.name}</h4>
              <p class="retailer-domain">${retailer.domain}</p>
            </div>
            <div class="permission-status ${statusClass}">
              <span class="status-dot"></span>
              <span class="status-text">${statusText}</span>
            </div>
          </div>
          
          <div class="retailer-features">
            <div class="feature">
              <span class="feature-icon">📦</span>
              <span class="feature-text">Product Monitoring</span>
            </div>
            ${retailer.hasCartIntegration ? `
              <div class="feature">
                <span class="feature-icon">🛒</span>
                <span class="feature-text">Cart Integration</span>
              </div>
            ` : ''}
            <div class="feature">
              <span class="feature-icon">💸</span>
              <span class="feature-text">Price Tracking</span>
            </div>
          </div>
          
          <div class="retailer-actions">
            <button 
              class="btn ${buttonClass} permission-toggle-btn" 
              data-retailer="${id}"
              data-action="${hasPermission ? 'revoke' : 'grant'}"
            >
              ${buttonText} Permission
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  private setupEventListeners(): void {
    // Individual retailer permission toggles
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('permission-toggle-btn')) {
        const retailerId = target.dataset['retailer'] as RetailerId;
        const action = target.dataset['action'];
        
        if (retailerId && action) {
          await this.handlePermissionToggle(retailerId, action as 'grant' | 'revoke');
        }
      }
    });

    // Grant all permissions
    const grantAllBtn = this.container.querySelector('#grant-all-btn');
    grantAllBtn?.addEventListener('click', () => this.handleGrantAllPermissions());

    // Revoke all permissions
    const revokeAllBtn = this.container.querySelector('#revoke-all-btn');
    revokeAllBtn?.addEventListener('click', () => this.handleRevokeAllPermissions());
  }

  private async handlePermissionToggle(retailerId: RetailerId, action: 'grant' | 'revoke'): Promise<void> {
    const button = this.container.querySelector(`[data-retailer="${retailerId}"].permission-toggle-btn`) as HTMLButtonElement;
    const card = this.container.querySelector(`[data-retailer="${retailerId}"].retailer-card`) as HTMLElement;
    
    if (!button || !card) return;

    // Show loading state
    button.disabled = true;
    button.textContent = action === 'grant' ? 'Granting...' : 'Revoking...';

    try {
      let response;
      
      if (action === 'grant') {
        response = await sendExtensionMessage({
          type: 'REQUEST_RETAILER_PERMISSION' as MessageType,
          payload: { 
            retailerId, 
            reason: `Enable ${SUPPORTED_RETAILERS[retailerId].name} monitoring and checkout assistance` 
          }
        });
      } else {
        response = await sendExtensionMessage({
          type: 'REMOVE_RETAILER_PERMISSION' as MessageType,
          payload: { retailerId }
        });
      }

      if (response.success) {
        const data = (response.data || {}) as { granted?: boolean; removed?: boolean };
        const success = action === 'grant' ? !!data.granted : !!data.removed;
        
        if (success) {
          // Update local state
          this.permissionStatuses.set(retailerId, action === 'grant');
          
          // Update UI
          this.updateRetailerCard(retailerId, action === 'grant');
          this.updatePermissionStats();
          
          // Show success message
          this.showMessage(`Permission ${action === 'grant' ? 'granted' : 'revoked'} for ${SUPPORTED_RETAILERS[retailerId].name}`, 'success');
        } else {
          this.showMessage(`Failed to ${action} permission for ${SUPPORTED_RETAILERS[retailerId].name}`, 'error');
        }
      } else {
        this.showMessage(`Error: ${response.error?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      log('error', `Failed to ${action} permission for ${retailerId}`, error);
      this.showMessage(`Failed to ${action} permission`, 'error');
    } finally {
      // Reset button state
      button.disabled = false;
      this.updateButtonState(button, this.permissionStatuses.get(retailerId) || false);
    }
  }

  private async handleGrantAllPermissions(): Promise<void> {
    const retailerIds = Object.keys(SUPPORTED_RETAILERS) as RetailerId[];
    const ungrantedRetailers = retailerIds.filter(id => !this.permissionStatuses.get(id));
    
    if (ungrantedRetailers.length === 0) {
      this.showMessage('All permissions are already granted', 'info');
      return;
    }

    const grantAllBtn = this.container.querySelector('#grant-all-btn') as HTMLButtonElement;
    grantAllBtn.disabled = true;
    grantAllBtn.textContent = 'Granting Permissions...';

    try {
      // Request permissions for all ungranted retailers
      for (const retailerId of ungrantedRetailers) {
        const response = await sendExtensionMessage({
          type: 'REQUEST_RETAILER_PERMISSION' as any,
          payload: { 
            retailerId, 
            reason: 'Enable monitoring and checkout assistance for all supported retailers' 
          }
        });

        if (response.success && (response.data as { granted?: boolean }).granted) {
          this.permissionStatuses.set(retailerId, true);
          this.updateRetailerCard(retailerId, true);
        }
      }

      this.updatePermissionStats();
      this.showMessage('Permissions updated for all retailers', 'success');
    } catch (error) {
      log('error', 'Failed to grant all permissions', error);
      this.showMessage('Failed to grant all permissions', 'error');
    } finally {
      grantAllBtn.disabled = false;
      grantAllBtn.textContent = 'Grant All Permissions';
    }
  }

  private async handleRevokeAllPermissions(): Promise<void> {
    const retailerIds = Object.keys(SUPPORTED_RETAILERS) as RetailerId[];
    const grantedRetailers = retailerIds.filter(id => this.permissionStatuses.get(id));
    
    if (grantedRetailers.length === 0) {
      this.showMessage('No permissions to revoke', 'info');
      return;
    }

    const confirmed = confirm(`Are you sure you want to revoke permissions for all ${grantedRetailers.length} retailers? This will disable monitoring and checkout assistance.`);
    if (!confirmed) return;

    const revokeAllBtn = this.container.querySelector('#revoke-all-btn') as HTMLButtonElement;
    revokeAllBtn.disabled = true;
    revokeAllBtn.textContent = 'Revoking Permissions...';

    try {
      for (const retailerId of grantedRetailers) {
        const response = await sendExtensionMessage({
          type: 'REMOVE_RETAILER_PERMISSION' as any,
          payload: { retailerId }
        });

        if (response.success && (response.data as { removed?: boolean }).removed) {
          this.permissionStatuses.set(retailerId, false);
          this.updateRetailerCard(retailerId, false);
        }
      }

      this.updatePermissionStats();
      this.showMessage('All permissions revoked', 'success');
    } catch (error) {
      log('error', 'Failed to revoke all permissions', error);
      this.showMessage('Failed to revoke all permissions', 'error');
    } finally {
      revokeAllBtn.disabled = false;
      revokeAllBtn.textContent = 'Revoke All Permissions';
    }
  }

  private updateRetailerCard(retailerId: RetailerId, hasPermission: boolean): void {
    const card = this.container.querySelector(`[data-retailer="${retailerId}"].retailer-card`) as HTMLElement;
    const button = this.container.querySelector(`[data-retailer="${retailerId}"].permission-toggle-btn`) as HTMLButtonElement;
    const status = card?.querySelector('.permission-status') as HTMLElement;
    const statusText = status?.querySelector('.status-text') as HTMLElement;

    if (!card || !button || !status || !statusText) return;

    // Update card class
    card.className = `retailer-card ${hasPermission ? 'granted' : 'not-granted'}`;
    
    // Update status
    status.className = `permission-status ${hasPermission ? 'granted' : 'not-granted'}`;
    statusText.textContent = hasPermission ? 'Granted' : 'Not Granted';
    
    // Update button
    this.updateButtonState(button, hasPermission);
  }

  private updateButtonState(button: HTMLButtonElement, hasPermission: boolean): void {
    button.className = `btn ${hasPermission ? 'btn-danger' : 'btn-primary'} permission-toggle-btn`;
    button.textContent = `${hasPermission ? 'Revoke' : 'Grant'} Permission`;
    button.dataset['action'] = hasPermission ? 'revoke' : 'grant';
  }

  private updatePermissionStats(): void {
    const grantedCount = Array.from(this.permissionStatuses.values()).filter(Boolean).length;
    const totalCount = Object.keys(SUPPORTED_RETAILERS).length;

    const grantedCountEl = this.container.querySelector('#granted-count');
    const totalCountEl = this.container.querySelector('#total-count');

    if (grantedCountEl) grantedCountEl.textContent = grantedCount.toString();
    if (totalCountEl) totalCountEl.textContent = totalCount.toString();
  }

  private showMessage(message: string, type: 'success' | 'error' | 'info'): void {
    // Create or update message element
    let messageEl = this.container.querySelector('.permissions-message') as HTMLElement;
    
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'permissions-message';
      this.container.insertBefore(messageEl, this.container.firstChild);
    }

    messageEl.className = `permissions-message ${type}`;
    messageEl.textContent = message;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      messageEl.remove();
    }, 3000);
  }

  /**
   * Refresh permission statuses from background script
   */
  async refresh(): Promise<void> {
    await this.loadPermissionStatuses();
    
    // Update all retailer cards
    for (const [retailerId, hasPermission] of this.permissionStatuses.entries()) {
      this.updateRetailerCard(retailerId, hasPermission);
    }
    
    this.updatePermissionStats();
  }
}
