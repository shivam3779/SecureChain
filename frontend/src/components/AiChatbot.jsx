import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  ShieldCheck,
  AlertTriangle,
  Terminal,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { api } from '../lib/api';
import { Spinner } from './ui';

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const codeText = String(children).replace(/\n$/, '');

  if (inline || (!match && !codeText.includes('\n'))) {
    return (
      <code
        className="font-mono text-[11px] bg-slate-100 text-emerald-800 border border-slate-200/90 px-1.5 py-0.5 rounded font-medium inline-block"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 shadow-sm text-left">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-slate-300 select-none">
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-slate-400">
          <Terminal size={11} className="text-emerald-400" />
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-slate-800"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-100">
        <pre className="m-0 p-0 font-mono">
          <code>{children}</code>
        </pre>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 shadow-2xs border ${
          isUser
            ? 'bg-slate-900 text-white border-slate-800'
            : 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/10'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div
        className={`relative max-w-[86%] rounded-2xl text-xs leading-relaxed shadow-2xs transition-all ${
          isUser
            ? 'bg-slate-900 text-white rounded-tr-xs px-3.5 py-2.5 font-normal'
            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs px-4 py-3'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        ) : (
          <div>
            {msg.streaming ? (
              <div className="flex items-center gap-1.5 text-slate-500 py-1 font-mono text-[11px]">
                <Spinner size={12} color="#059669" />
                <span>Analyzing security context...</span>
                <span className="inline-block w-1.5 h-3 bg-emerald-600 ml-0.5 animate-pulse" />
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-xs leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1
                        className="text-sm font-bold text-slate-900 mt-3 mb-1.5 pb-1 border-b border-slate-200/80 first:mt-0"
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2
                        className="text-xs font-bold text-slate-900 mt-2.5 mb-1.5 first:mt-0 flex items-center gap-1.5 text-slate-900"
                        {...props}
                      />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3
                        className="text-xs font-semibold text-slate-800 mt-2 mb-1 first:mt-0"
                        {...props}
                      />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="mb-2 last:mb-0 leading-relaxed text-slate-700" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul
                        className="list-disc pl-4 mb-2.5 space-y-1 text-slate-700 marker:text-emerald-600"
                        {...props}
                      />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol
                        className="list-decimal pl-4 mb-2.5 space-y-1 text-slate-700 marker:text-slate-500"
                        {...props}
                      />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="leading-relaxed" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="font-semibold text-slate-900" {...props} />
                    ),
                    em: ({ node, ...props }) => (
                      <em className="italic text-slate-800" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="border-l-3 border-emerald-500 bg-emerald-50/70 pl-3 py-1.5 my-2.5 rounded-r text-xs text-emerald-950 font-medium"
                        {...props}
                      />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-2.5 rounded-lg border border-slate-200 shadow-2xs">
                        <table
                          className="min-w-full divide-y divide-slate-200 text-left text-[11px]"
                          {...props}
                        />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead className="bg-slate-50 text-slate-700 font-semibold" {...props} />
                    ),
                    tbody: ({ node, ...props }) => (
                      <tbody className="divide-y divide-slate-100 bg-white" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th
                        className="px-2.5 py-1.5 font-semibold text-slate-800 border-b border-slate-200"
                        {...props}
                      />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-2.5 py-1.5 text-slate-700" {...props} />
                    ),
                    a: ({ node, ...props }) => (
                      <a
                        className="text-emerald-700 hover:text-emerald-800 underline font-medium inline-flex items-center gap-0.5"
                        target="_blank"
                        rel="noreferrer"
                        {...props}
                      />
                    ),
                    hr: ({ node, ...props }) => (
                      <hr className="my-2.5 border-slate-200" {...props} />
                    ),
                    code: CodeBlock,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Response action footer for assistant */}
            {!msg.streaming && msg.content && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  Verified Security Guidance
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100"
                  title="Copy full response"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="text-emerald-600" />
                      <span className="text-emerald-600 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STARTER_CATEGORIES = [
  {
    title: 'Explain CVE-2021-44228 (Log4Shell)',
    tag: 'CVE Analysis',
    icon: AlertTriangle,
  },
  {
    title: 'What is a typosquatting attack?',
    tag: 'Attack Vector',
    icon: ShieldAlert,
  },
  {
    title: 'How does EPSS scoring work in triage?',
    tag: 'Prioritization',
    icon: Sparkles,
  },
  {
    title: 'What are the core requirements for SLSA Level 2?',
    tag: 'Standards',
    icon: ShieldCheck,
  },
];

export default function AiChatbot({ repoId }) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(null);
  const [llmInfo, setLlmInfo] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
    if (open && apiAvailable === null) checkAvailability();
  }, [open]);

  async function checkAvailability() {
    try {
      const info = await api.aiModelInfo();
      setLlmInfo(info?.llm || null);
      setApiAvailable(true);
    } catch {
      setApiAvailable(false);
    }
  }

  async function send(text) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const assistantIdx = newMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const { reply } = await api.aiChat(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        repoId
      );
      setMessages(prev =>
        prev.map((m, i) =>
          i === assistantIdx ? { role: 'assistant', content: reply, streaming: false } : m
        )
      );
    } catch (err) {
      const errMsg = err.message.includes('AI features disabled')
        ? 'AI features need `GEMINI_API_KEY` set in backend `.env`.'
        : `Error: ${err.message}`;
      setMessages(prev =>
        prev.map((m, i) =>
          i === assistantIdx ? { role: 'assistant', content: errMsg, streaming: false } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-grow textarea up to 120px
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 border border-slate-700/60"
        title="AI Security Copilot"
        aria-label="Open AI Security Assistant"
      >
        <div className="relative flex items-center justify-center">
          <Bot size={18} className="text-emerald-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        {/* <span className="text-xs font-semibold tracking-tight pr-1">Ask AI</span> */}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-20 right-6 z-50 flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-in-out ${
            isExpanded
              ? 'w-[680px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[calc(100vh-6rem)]'
              : 'w-[440px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-6rem)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/90 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Bot size={15} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-bold text-xs tracking-tight truncate">
                    AI Security Copilot
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-100/80 text-emerald-800 border border-emerald-200 font-medium">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate font-mono">
                  {llmInfo?.model || 'Supply Chain DevSecOps Agent'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(exp => !exp)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/40">
            {messages.length === 0 && (
              <div className="space-y-3 py-2">
                <div className="text-center space-y-1 mb-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mb-1 border border-emerald-100">
                    <Sparkles size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Software Supply Chain Intelligence</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Ask about CVE impact, dependency vulnerabilities, malicious packages, or remediation fixes.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {STARTER_CATEGORIES.map(s => {
                    const IconComponent = s.icon;
                    return (
                      <button
                        key={s.title}
                        onClick={() => send(s.title)}
                        className="group w-full text-left p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                            <IconComponent size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate group-hover:text-slate-900">
                              {s.title}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {s.tag}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-600 transition-colors shrink-0 ml-2" />
                      </button>
                    );
                  })}

                  {repoId && (
                    <button
                      onClick={() => send('What are the biggest security risks in this repository?')}
                      className="w-full text-left p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 hover:bg-emerald-100/70 hover:border-emerald-300 transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <ShieldCheck size={13} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-950">
                            Analyze this repository's security posture
                          </p>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            Context-aware repository scan
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={13} className="text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-slate-100 bg-white">
            <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-slate-800 focus-within:bg-white focus-within:shadow-2xs transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about vulnerabilities, CVEs, or package risks..."
                disabled={loading}
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 resize-none max-h-28 focus:outline-none leading-relaxed py-1"
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer shadow-2xs mb-0.5"
                title="Send message (Enter)"
              >
                {loading ? <Spinner size={12} color="#ffffff" /> : <Send size={13} />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-[9px] text-slate-400 font-mono">
              <span>Shift+Enter for newline</span>
              <span>
                {llmInfo?.model ? `Model: ${llmInfo.model}` : 'SecureChain Intelligence'}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
