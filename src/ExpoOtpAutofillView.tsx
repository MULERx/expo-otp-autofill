import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoOtpAutofillViewProps } from './ExpoOtpAutofill.types';

const NativeView: React.ComponentType<ExpoOtpAutofillViewProps> =
  requireNativeView('ExpoOtpAutofill');

export default function ExpoOtpAutofillView(props: ExpoOtpAutofillViewProps) {
  return <NativeView {...props} />;
}
