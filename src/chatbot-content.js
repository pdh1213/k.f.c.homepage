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

const normalizeQuestion=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const pairs=value=>{const result=new Map();for(let i=0;i<value.length-1;i++){const pair=value.slice(i,i+2);result.set(pair,(result.get(pair)||0)+1)}return result};
const similarity=(a,b)=>{if(a.length<6||b.length<6)return 0;const left=pairs(a),right=pairs(b);let overlap=0;for(const [part,count] of left)overlap+=Math.min(count,right.get(part)||0);return 2*overlap/(a.length+b.length-2)};
export function findKnowledgeAnswer(knowledge,question){
  const asked=normalizeQuestion(question);if(!asked||asked.length>500)return null;
  let best=null,score=0;
  for(const item of knowledge||[]){
    for(const variant of [item.question,...(Array.isArray(item.aliases)?item.aliases:[])]){
      const known=normalizeQuestion(variant);if(!known)continue;
      if(known===asked)return item;
      const current=similarity(asked,known);
      if(current>.82&&current>score){best=item;score=current}
    }
  }
  return best;
}

