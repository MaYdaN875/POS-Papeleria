import { GlobalSettings } from '../settingsService';
import { InvoiceProvider } from '../../types/invoicing';
import { MockProvider } from './MockProvider';
import { FacturaComProvider } from './FacturaComProvider';
import { EcoFacturaProvider } from './EcoFacturaProvider';

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

    if (providerType === 'ecofactura') {
      return new EcoFacturaProvider();
    }

    // Default to mock strategy
    return new MockProvider();
  }
}
