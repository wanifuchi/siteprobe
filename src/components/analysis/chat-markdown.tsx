'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

interface ChatMarkdownProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-gray-300 hover:text-white"
      aria-label="コードをコピー"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown text-sm leading-relaxed">
      <ReactMarkdown
        components={{
          // コードブロック
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            // インラインコードかブロックコードかを判定
            const isInline = !match && !codeString.includes('\n');

            if (isInline) {
              return (
                <code
                  className="bg-muted rounded px-1 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // ブロックコード（シンタックスハイライト付き）
            return (
              <div className="relative my-2 rounded-md overflow-hidden">
                {match && (
                  <div className="bg-[#1e1e1e] px-3 py-1 text-xs text-gray-400 border-b border-gray-700">
                    {match[1]}
                  </div>
                )}
                <CopyButton text={codeString} />
                <SyntaxHighlighter
                  style={oneDark}
                  language={match ? match[1] : 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          // 見出し
          h1: ({ children }) => <h4 className="font-bold mt-3 mb-1">{children}</h4>,
          h2: ({ children }) => <h4 className="font-bold mt-3 mb-1">{children}</h4>,
          h3: ({ children }) => <h5 className="font-semibold mt-2 mb-1">{children}</h5>,
          // 段落
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          // リスト
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // リンク
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              {children}
            </a>
          ),
          // 強調
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          // 水平線
          hr: () => <hr className="my-3 border-muted" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
