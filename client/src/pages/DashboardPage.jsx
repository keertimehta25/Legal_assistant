import React from 'react';
import { useSession } from '../context/SessionContext';

export default function DashboardPage() {
    const { analysisResult } = useSession();

    if (!analysisResult) {
        return <div className="text-center mt-20 text-slate-500">No document analyzed yet. Please upload a document first.</div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-slate-800">Document Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Obligations */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-semibold mb-4 text-blue-700">Key Obligations</h3>
                    <ul className="list-disc pl-5 space-y-2 text-slate-700">
                        {analysisResult.key_obligations?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>

                {/* Deadlines */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xl font-semibold mb-4 text-emerald-700">Important Dates & Deadlines</h3>
                    <ul className="list-disc pl-5 space-y-2 text-slate-700">
                        {analysisResult.important_dates_or_deadlines?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
            </div>

            {/* Risky Clauses */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-semibold mb-4 text-rose-700">Risky or Unusual Clauses</h3>
                <div className="space-y-4">
                    {analysisResult.risky_or_unusual_clauses?.map((clause, i) => (
                        <div key={i} className={`p-4 border-l-4 rounded bg-slate-50 ${clause.risk_level === 'high' ? 'border-red-500' : clause.risk_level === 'medium' ? 'border-yellow-500' : 'border-green-500'}`}>
                            <p className="font-medium text-slate-800">"{clause.clause_text}"</p>
                            <p className="text-slate-600 mt-2 text-sm"><span className="font-semibold">Why it matters:</span> {clause.why_it_matters}</p>
                            <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-slate-200 uppercase tracking-wider">{clause.risk_level} risk</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Missing Terms */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-semibold mb-4 text-amber-700">Missing or Unclear Terms</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-700">
                    {analysisResult.missing_or_unclear_terms?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </div>
        </div>
    );
}
