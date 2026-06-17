import { GlobalSettings } from '../settingsService';
import { InvoiceProvider } from '../../types/invoicing';
import { MockProvider } from './MockProvider';
import { FacturaComProvider } from './FacturaComProvider';

export class InvoiceFactory {
  /**
   * Instantiates the correct InvoiceProvider strategy based on the current GlobalSettings.
   */
  static createProvider(settings: GlobalSettings): InvoiceProvider {
    const providerType = settings.invoiceProvider || 'mock';

    if (providerType === 'facturacom') {
      const apiKey = settings.facturacomApiKey || '';
      const secretKey = settings.facturacomSecretKey || '';
      const sandbox = settings.facturacomSandbox !== false; // default to true (sandbox) for safety

      return new FacturaComProvider(apiKey, secretKey, sandbox);
    }

    // Default to mock strategy
    return new MockProvider();
  }
}
