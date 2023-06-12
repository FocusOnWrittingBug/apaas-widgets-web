import { addResourceBundle } from 'agora-common-libs/lib';

import en from './en';
import zh from './zh';

export const addResource = () => {
  addResourceBundle('zh', zh);
  addResourceBundle('en', en);
};
