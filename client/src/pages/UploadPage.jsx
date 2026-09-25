import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { uploadDocument, indexDocument, analyzeDocument } from '../api/client';

export default function UploadPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');   // step-by-step status message
    const [error, setError] = useState('');
    const { setDocumentText, setAnalysisResult, sessionId } = useSession();
    const navigate = useNavigate();

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        setError('');
        setStatus('Uploading and extracting text...');

        try {
            // 1. Upload & Extract Text
            const { text } = await uploadDocument(file);
            setDocumentText(text);

            // 2. Index (embeddings for Q&A) + Analyze run in parallel — both only need `text`
            setStatus('Indexing & analyzing document (AI service may retry automatically)...');
            const [, analysis] = await Promise.all([
                indexDocument(sessionId, text),
                analyzeDocument(text),
            ]);
            setAnalysisResult(analysis);

            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-10 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-5">
                        <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Upload Legal Document</h2>
                    <p className="text-slate-400">Upload a PDF or DOCX file to get a plain-English AI analysis.</p>
                </div>

                <label
                    htmlFor="document-upload"
                    className={`block border-2 border-dashed rounded-xl p-14 text-center transition-all cursor-pointer
                    ${loading
                        ? 'border-blue-500/50 bg-blue-500/5 cursor-not-allowed'
                        : 'border-slate-600 hover:border-blue-400 hover:bg-blue-500/5 focus-within:ring-2 focus-within:ring-blue-400'}`}>
                    <input
                        id="document-upload"
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileUpload}
                        className="sr-only"
                        disabled={loading}
                        aria-describedby="upload-instructions"
                    />
                    {loading ? (
                        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
                            <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                            <span className="text-blue-300 font-medium">{status || 'Processing...'}</span>
                            <span className="text-slate-500 text-sm">The AI is working — it will retry automatically if busy.</span>
                        </div>
                    ) : (
                        <div id="upload-instructions" className="flex flex-col items-center gap-3 text-slate-400">
                            <svg className="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-lg font-medium text-slate-300">Drag and drop your file here</span>
                            <span className="text-sm">or click to browse</span>
                            <span className="text-xs text-slate-600 mt-1">PDF · DOCX supported</span>
                        </div>
                    )}
                </label>

                {error && (
                    <div role="alert" className="mt-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}

                <p className="text-center text-slate-600 text-xs mt-6">
                    LegalLens provides general information only and is not a substitute for advice from a licensed attorney.
                </p>
            </div>
        </div>
    );
}
