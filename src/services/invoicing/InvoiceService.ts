import { InvoiceProvider, InvoiceRequest, InvoiceResponse } from '../../types/invoicing';
import { MockProvider } from './MockProvider';

class InvoiceServiceClass {
  private provider: InvoiceProvider;

  constructor() {
    // Default to MockProvider so the app has a fallback strategy immediately
    this.provider = new MockProvider();
  }

  /**
   * Inject the active invoice provider strategy.
   */
  setProvider(provider: InvoiceProvider): void {
    console.log(`[InvoiceService] Injecting strategy: ${provider.getName()}`);
    this.provider = provider;
  }

  /**
   * Get the name of the currently active invoice provider.
   */
  getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Request invoice creation from the active provider.
   */
  async createInvoice(request: InvoiceRequest): Promise<InvoiceResponse> {
    return this.provider.createInvoice(request);
  }

  /**
   * Request invoice cancelation from the active provider.
   */
  async cancelInvoice(uuid: string, reason: string): Promise<{ success: boolean; message?: string }> {
    return this.provider.cancelInvoice(uuid, reason);
  }
}

// Export a single instance to be used throughout the app (Singleton)
export const InvoiceService = new InvoiceServiceClass();
