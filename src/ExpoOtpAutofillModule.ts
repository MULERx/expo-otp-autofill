import { NativeModule, requireNativeModule } from 'expo';
import { ExpoOtpAutofillModuleEvents } from './ExpoOtpAutofill.types';

declare class ExpoOtpAutofillModule extends NativeModule<ExpoOtpAutofillModuleEvents> {
  getAppHashAsync(): Promise<string>;
  startSmsRetrieverAsync(): Promise<boolean>;
  stopSmsRetrieverAsync(): void;
}

export default requireNativeModule<ExpoOtpAutofillModule>('ExpoOtpAutofill');
