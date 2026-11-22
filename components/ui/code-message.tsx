import { Check, Copy } from 'lucide-react';
import { Highlight, Prism, themes } from 'prism-react-renderer';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/chat';

const aliases: Partial<Record<CodeLanguage, string>> = { arduino: 'cpp', html: 'markup', text: 'plain' };

export function CodeMessage({ code, language }: { code: string; language: CodeLanguage }) {
  const [copied, setCopied] = useState(false);
  const label = CODE_LANGUAGES[language] || '코드';
  const syntax = aliases[language] ?? language;
  const grammar = Prism.languages[syntax] ? syntax : 'plain';

  async function copy() {
    const app = window.kfcChat;
    if (!app) return;
    try { await app.copy(code); setCopied(true); }
    catch { setCopied(false); }
  }

  return <div className="code-message">
    <div className="code-message-header">
      <strong>{label}</strong>
      <Button variant="ghost" size="sm" onClick={() => void copy()} aria-label="코드 복사">
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사했어요' : '복사'}
      </Button>
    </div>
    <Highlight code={code} language={grammar} theme={themes.vsDark}>{({ tokens, getLineProps, getTokenProps }) =>
      <pre className="code-lines" tabIndex={0} aria-label={`${label} 코드`}><code>
        {tokens.map((line, index) => <span key={index} {...getLineProps({ line })}>
          <span className="code-line-number" aria-hidden="true">{index + 1}</span>
          <span>{line.map((token, offset) => <span key={offset} {...getTokenProps({ token })} />)}</span>
        </span>)}
      </code></pre>
    }</Highlight>
  </div>;
}
