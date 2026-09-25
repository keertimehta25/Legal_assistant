import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { askQuestion } from '../api/client';

export default function ChatPanel() {
    const { sessionId, documentText } = useSession();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    if (!documentText) return null; // Only show chat if document is loaded

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userQ = input;
        setMessages(prev => [...prev, { role: 'user', content: userQ }]);
        setInput('');
        setLoading(true);

        try {
            const data = await askQuestion(sessionId, userQ);

            setMessages(prev => [...prev, {
                role: 'bot',
                content: data.answer,
                chunks: data.chunks
            }]);
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', content: `Sorry, I encountered an error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`fixed bottom-0 right-8 w-96 bg-white border border-slate-300 rounded-t-xl shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'h-[600px] translate-y-0' : 'h-14 translate-y-0'}`}>
            {/* Header */}
            <button
                type="button"
                className="bg-blue-700 text-white p-4 rounded-t-xl cursor-pointer flex justify-between items-center w-full text-left"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="chat-panel-body"
            >
                <h3 className="font-bold">Ask about your Document</h3>
                <span aria-hidden="true">{open ? '▼' : '▲'}</span>
            </button>

            {/* Chat Body */}
            {open && (
                <div id="chat-panel-body" className="flex flex-col flex-grow min-h-0">
                    <div className="flex-grow p-4 overflow-y-auto bg-slate-50 space-y-4" aria-live="polite">
                        {messages.length === 0 && (
                            <p className="text-slate-400 text-center mt-10">Ask a question like "What is the termination period?"</p>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-3 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                    {m.content}
                                </div>
                                {m.chunks && m.chunks.length > 0 && (
                                    <details className="text-xs text-slate-500 mt-1 max-w-[85%]">
                                        <summary className="cursor-pointer">View Source Excerpts</summary>
                                        <div className="mt-2 p-2 bg-slate-100 rounded border border-slate-200 italic line-clamp-3 hover:line-clamp-none">
                                            {m.chunks[0]}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                        {loading && <div className="text-slate-400 text-sm animate-pulse">Thinking...</div>}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                        <label htmlFor="chat-question-input" className="sr-only">Ask a question about your document</label>
                        <input
                            id="chat-question-input"
                            type="text"
                            className="flex-grow p-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500"
                            placeholder="Ask a question..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
                            disabled={loading}
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
