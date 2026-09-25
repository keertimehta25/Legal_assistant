import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { uploadDocument, compareDocuments } from '../api/client';

function UploadSlot({ id, label, fileName, onFileSelected, disabled }) {
    return (
        <div>
            <label
                htmlFor={id}
                className={`block border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
            ${disabled ? 'border-slate-300 bg-slate-100 cursor-not-allowed' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-400'}`}
            >
                <input
                    id={id}
                    type="file"
                    accept=".pdf,.docx"
                    className="sr-only"
                    disabled={disabled}
                    aria-label={`Upload ${label} (PDF or DOCX)`}
                    onChange={(e) => e.target.files[0] && onFileSelected(e.target.files[0])}
                />
                <p className="font-medium text-slate-700">{label}</p>
                <p className="text-sm text-slate-500 mt-1">{fileName || 'Click to upload PDF or DOCX'}</p>
            </label>
        </div>
    );
}

const FAVORABLE_LABELS = {
    A: 'Document A more favorable',
    B: 'Document B more favorable',
};

export default function ComparePage() {
    const { documentText } = useSession();

    const [docAText, setDocAText] = useState(documentText || '');
    const [docAName, setDocAName] = useState(documentText ? 'Currently loaded document' : '');
    const [docBText, setDocBText] = useState('');
    const [docBName, setDocBName] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleUpload = async (which, file) => {
        setError('');
        try {
            const { text } = await uploadDocument(file);
            if (which === 'A') {
                setDocAText(text);
                setDocAName(file.name);
            } else {
                setDocBText(text);
                setDocBName(file.name);
            }
        } catch (err) {
            setError(`Failed to read Document ${which}: ${err.message}`);
        }
    };

    const handleCompare = async () => {
        if (!docAText || !docBText) {
            setError('Please provide both Document A and Document B before comparing.');
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const data = await compareDocuments(docAText, docBText);
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Compare Documents</h2>
                <p className="text-slate-500">
                    Upload two versions of a contract, or two competing agreements, to see how their
                    terms differ, which version is more favorable on each point, and what's missing
                    from either.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <UploadSlot id="doc-a-upload" label="Document A" fileName={docAName} disabled={loading} onFileSelected={(f) => handleUpload('A', f)} />
                <UploadSlot id="doc-b-upload" label="Document B" fileName={docBName} disabled={loading} onFileSelected={(f) => handleUpload('B', f)} />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
            )}

            <button
                onClick={handleCompare}
                disabled={loading || !docAText || !docBText}
                className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Comparing...' : 'Compare Documents'}
            </button>

            {result?.topics && (
                <div className="space-y-6">
                    {result.topics.map((topic, i) => (
                        <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xl font-semibold text-slate-800 mb-4">{topic.topic_name}</h3>

                            {topic.differences?.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    {topic.differences.map((diff, j) => (
                                        <div key={j} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="text-slate-700">{diff.description}</p>
                                            {diff.more_favorable_doc && (
                                                <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide">
                                                    {FAVORABLE_LABELS[diff.more_favorable_doc] || diff.more_favorable_doc}
                                                </span>
                                            )}
                                            {diff.reason && <p className="text-slate-500 text-sm mt-2">{diff.reason}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {topic.missing_clauses?.length > 0 && (
                                <div>
                                    <p className="text-sm font-semibold text-amber-700 mb-2">
                                        Present in one document but missing from the other:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 text-slate-600 text-sm">
                                        {topic.missing_clauses.map((clause, k) => (
                                            <li key={k}>{clause}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
