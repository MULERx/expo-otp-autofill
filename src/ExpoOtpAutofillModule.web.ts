import { registerWebModule, NativeModule } from 'expo';

import { ExpoOtpAutofillModuleEvents } from './ExpoOtpAutofill.types';

class ExpoOtpAutofillModule extends NativeModule<ExpoOtpAutofillModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(ExpoOtpAutofillModule, 'ExpoOtpAutofillModule');
