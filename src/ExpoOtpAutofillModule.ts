import { NativeModule, requireNativeModule } from 'expo';

import { ExpoOtpAutofillModuleEvents } from './ExpoOtpAutofill.types';

declare class ExpoOtpAutofillModule extends NativeModule<ExpoOtpAutofillModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoOtpAutofillModule>('ExpoOtpAutofill');
