import * as React from 'react';

import { ExpoOtpAutofillViewProps } from './ExpoOtpAutofill.types';

export default function ExpoOtpAutofillView(props: ExpoOtpAutofillViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
