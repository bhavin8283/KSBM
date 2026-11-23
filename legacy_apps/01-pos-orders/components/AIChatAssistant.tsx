import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Trash2,
  Minimize2,
  Maximize2,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  Package,
  Users,
  Store,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isAI?: boolean;
  source?: string;
  error?: boolean;
}

interface Suggestion {
  id: string;
  label: string;
  query: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { id: 'milk_dept', label: '🥛 How much Milk department sell today', query: 'How much did Milk department sell today?' },
  { id: 'top_dept', label: '🏬 Top departments today', query: 'What are our top departments today?' },
  { id: 'dare', label: '☕ 750ml dare double esp', query: '750ml dare double esp' },
  { id: 'code', label: '🔢 Check Item Code: 20221346', query: 'item code: 20221346' },
  { id: 'top5', label: '📈 Top 5 sellers this week', query: 'What are our top 5 best selling products this week?' },
  { id: 'staff', label: '👤 Bhavin\'s sales performance', query: 'How is Bhavin performing today?' },
];

export const AIChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('idealpos_assistant_history');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        text: "👋 Hi! I'm your **IdealPOS Store Assistant**.\n\nYou can ask me about:\n* 🥛 **Department & Category Sales:** e.g., *\"How much did Milk department sell today?\"* or *\"Top departments today\"*\n* 📦 **Product Stock & Sales Velocity:** e.g., *\"750ml dare double esp\"* or *\"Full Cream Milk\"*\n* 🔢 **Item Code / Barcode Lookup:** e.g., *\"item code: 20221346\"* or *\"93100472\"*\n* 📈 **Best Sellers:** e.g., *\"What are the top 5 sellers this week?\"*\n* 👤 **Staff & Cashier Performance:** e.g., *\"How did Bhavin do today?\"*\n* 🏪 **Store Totals:** e.g., *\"Give me today's store sales summary\"*\n\n💡 *Tip: Real-time queries run directly against your IdealPOS database with support for abbreviations, word order, and department names!*",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('idealpos_assistant_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages.slice(-6).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'No response returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: data.isAI,
        source: data.source || 'IdealPOS Live SQL',
        error: data.error,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Connection Error:** Could not reach the assistant service (${err.message || 'Network error'}). Please ensure the IdealPOS connection is active.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    const initialWelcome: ChatMessage = {
      id: `w_${Date.now()}`,
      sender: 'assistant',
      text: "👋 Chat history cleared. How can I help you check products, sales velocity, or staff performance today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([initialWelcome]);
  };

  const renderFormattedText = (raw: string) => {
    // Basic Markdown Parser for bold, bullets, headers, code
    const lines = raw.split('\n');
    return lines.map((line, idx) => {
      let content: React.ReactNode = line;

      // Header 3
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-bold text-slate-900 text-sm mt-2 mb-1 flex items-center gap-1.5">
            {line.replace('### ', '')}
          </h4>
        );
      }

      // Bullet points
      const isBullet = line.startsWith('* ') || line.startsWith('- ');
      const cleanLine = isBullet ? line.substring(2) : line;

      // Replace bold **text**
      const parts = cleanLine.split(/(\*\*.*?\*\*|\`.*?\`)/g);
      const parsedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={pIdx} className="bg-slate-100 text-slate-800 text-[11px] font-mono px-1 py-0.5 rounded border border-slate-200">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 my-0.5 pl-1">
            <span className="text-blue-500 font-bold">•</span>
            <span>{parsedParts}</span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="text-xs text-slate-700 leading-relaxed my-0.5">
          {parsedParts}
        </p>
      );
    });
  };

  return (
    <>
      {/* Floating Action Button (Collapsed) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
          title="Open AI Store Assistant"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-700 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-indigo-700" />
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-bold tracking-wide flex items-center gap-1.5">
              <span>Ask AI Assistant</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-medium uppercase tracking-wider">POS</span>
            </div>
            <div className="text-[10px] text-blue-100 font-medium">Products • Sales • Staff</div>
          </div>
        </button>
      )}

      {/* Expanded Chat Assistant Window */}
      {isOpen && (
        <div
          className={`fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ${
            isMinimized
              ? 'w-72 h-14'
              : 'w-[92vw] sm:w-[440px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-700/60 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-inner">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  IdealPOS Store AI
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live SQL
                  </span>
                </div>
                {!isMinimized && (
                  <div className="text-[10px] text-slate-300">
                    Direct access to inventory, sales & clerks
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              {!isMinimized && (
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body when not minimized */}
          {!isMinimized && (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${
                      msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-indigo-600 shadow-sm'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm text-xs ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-none'
                          : msg.error
                          ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <div>{renderFormattedText(msg.text)}</div>
                      )}

                      <div
                        className={`text-[9px] mt-1 flex items-center gap-1.5 ${
                          msg.sender === 'user' ? 'text-blue-200 justify-end' : 'text-slate-400 justify-between'
                        }`}
                      >
                        {msg.sender === 'assistant' && msg.source && (
                          <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            {msg.source}
                          </span>
                        )}
                        <span>{msg.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-sm">
                      <Bot className="w-3.5 h-3.5 animate-bounce" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      <span className="text-xs text-slate-500 font-medium">Checking IdealPOS database...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Pills */}
              <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto flex gap-1.5 no-scrollbar">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    onClick={() => handleSendMessage(sug.query)}
                    disabled={isLoading}
                    className="shrink-0 text-[11px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200/80 transition-colors disabled:opacity-50"
                  >
                    {sug.label}
                  </button>
                ))}
              </div>

              {/* Input Footer */}
              <div className="p-3 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask about product stock, sales, or staff..."
                    disabled={isLoading}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isLoading}
                    className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors shadow-sm shrink-0"
                    title="Send query"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                <div className="text-[10px] text-slate-400 text-center mt-1.5 flex items-center justify-center gap-1">
                  <span>Reads live from IdealPOS SQL</span>
                  <span>•</span>
                  <span>Safe Read-Only queries</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
export default AIChatAssistant;
