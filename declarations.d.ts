declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}
declare module 'bn.js';
declare module 'react-native-video';
declare module '*.png' {
  const value: import('react-native').ImageRequireSource;
  export default value;
}

declare module '*.jpg' {
  const value: import('react-native').ImageRequireSource;
  export default value;
}

declare module '*.jpeg' {
  const value: import('react-native').ImageRequireSource;
  export default value;
}

declare module '*.gif' {
  const value: import('react-native').ImageRequireSource;
  export default value;
}

declare module 'react-native-view-shot';
