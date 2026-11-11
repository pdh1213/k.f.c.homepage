export function safeChatbotLink(value){
  if(typeof value!=='string')return '';
  const url=value.trim();
  if(/^\/(?!\/)[a-zA-Z0-9/_?=&.%#-]*$/.test(url))return url;
  if(/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(url))return url;
  return '';
}

export function findInstantAnswer(faqs,question){
  const clean=value=>String(value||'').toLocaleLowerCase().replace(/[\s?.!·]/g,'');
  const exact=faqs.find(faq=>clean(faq.question)===clean(question));
  if(exact)return exact;
  if(/windows|윈도우/i.test(question)&&/앱|app|설치|다운로드|받|어디/i.test(question)){
    return faqs.find(faq=>/windows|윈도우/i.test(faq.question))||{
      answer:'쇼룸의 Windows App 메뉴에서 설치 파일을 내려받을 수 있습니다.',
      linkLabel:'Windows 앱 다운로드 페이지',linkUrl:'/download'
    };
  }
  return null;
}
