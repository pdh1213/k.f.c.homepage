import React from 'react';
import { MessageLoading } from './message-loading.tsx';
import './loading-indicator.css';

export default function LoadingIndicator({text='불러오는 중…',className=''}){
  return <span className={'kfc-loading '+className} role="status" aria-live="polite"><MessageLoading/><span>{text}</span></span>;
}
