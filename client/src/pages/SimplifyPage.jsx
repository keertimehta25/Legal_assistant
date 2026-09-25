import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { simplifyText } from '../api/client';

const READING_LEVELS = [
    { value: 'general public', label: 'General public' },
    { value: '8th grade', label: 'Simple (8th grade)' },
    { value: 'expert summary', label: 'Expert summary' },
];

export default function SimplifyPage() {
    const { documentText, simplifiedText, setSimplifiedText } = useSession();
    const [readingLevel, setReadingLevel] = useState('general public');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!documentText) {
        return (
            <div className="text-center mt-20 text-slate-500" role="status">
                No document uploaded yet. Please upload a document first.
            </div>
        );
    }

    const handleSimplify = async () => {
        setLoading(true);
        setError('');
        try {
            const { simplifiedText: result } = await simplifyText(documentText, readingLevel);
            setSimplifiedText(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Plain-Language Simplification</h2>
                <p className="text-slate-500">
                    See your document rewritten in plain English, at a reading level you choose. Nothing
                    important — obligations, deadlines — is dropped, just re-explained.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div>
                    <label htmlFor="reading-level" className="block text-sm font-medium text-slate-700 mb-1">
                        Reading level
                    </label>
                    <select
                        id="reading-level"
                        className="border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={readingLevel}
                        onChange={(e) => setReadingLevel(e.target.value)}
                        disabled={loading}
                    >
                        {READING_LEVELS.map((lvl) => (
                            <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleSimplify}
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed h-fit"
                >
                    {loading ? 'Simplifying…' : simplifiedText ? 'Re-simplify' : 'Simplify Document'}
                </button>
            </div>

            <div aria-live="polite">
                {loading && <p className="text-slate-500 animate-pulse">Rewriting your document in plain language…</p>}
                {error && (
                    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {simplifiedText && (
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-semibold mb-3 text-slate-800">Original</h3>
                        <div className="text-slate-600 text-sm whitespace-pre-wrap max-h-[32rem] overflow-y-auto">
                            {documentText}
                        </div>
                    </div>
                    <div className="bg-emerald-50 p-6 rounded-xl shadow-sm border border-emerald-200">
                        <h3 className="text-lg font-semibold mb-3 text-emerald-800">Plain Language</h3>
                        <div className="text-slate-700 text-sm whitespace-pre-wrap max-h-[32rem] overflow-y-auto">
                            {simplifiedText}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
