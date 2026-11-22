import React from 'react';

export const clubChatUrl='https://kfcchat.vercel.app/';

export function openClubChat(){
  window.open(clubChatUrl,'_blank','noopener,noreferrer');
}

export function ChatLink({className='button primary',children='K.F.C. Chat 열기 ↗'}){
  return <a className={className} href={clubChatUrl} target="_blank" rel="noopener noreferrer">{children}</a>;
}
