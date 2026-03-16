import { EventEmitter } from 'expo-modules-core';
import { ExpoOtpAutofillModuleEvents } from './ExpoOtpAutofill.types';

class ExpoOtpAutofillModuleWeb extends EventEmitter<ExpoOtpAutofillModuleEvents> {
  async getAppHashAsync(): Promise<string> {
    return "";
  }
  async startSmsRetrieverAsync(): Promise<boolean> {
    return false;
  }
  stopSmsRetrieverAsync(): void {
    // no-op
  }
}

export default new ExpoOtpAutofillModuleWeb();
