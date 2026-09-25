import React from 'react';
import { useSession } from '../context/SessionContext';

const RISK_STYLES = {
    high:   { border: 'border-red-500',    badge: 'bg-red-100 text-red-700',    label: 'High risk' },
    medium: { border: 'border-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: 'Medium risk' },
    low:    { border: 'border-green-500',  badge: 'bg-green-100 text-green-700', label: 'Low risk' },
};

function EmptyState({ message }) {
    return (
        <div className="text-center mt-20 text-slate-500" role="status" aria-live="polite">
            {message}
        </div>
    );
}

function Section({ title, colorClass, children }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className={`text-xl font-semibold mb-4 ${colorClass}`}>{title}</h3>
            {children}
        </div>
    );
}

export default function DashboardPage() {
    const { analysisResult } = useSession();

    if (!analysisResult) {
        return <EmptyState message="No document analyzed yet. Please upload a document first." />;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-slate-800">Document Analysis</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Key Obligations */}
                <Section title="Key Obligations" colorClass="text-blue-700">
                    {analysisResult.key_obligations?.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-2 text-slate-700">
                            {analysisResult.key_obligations.map((item) => (
                                <li key={item.slice(0, 40)}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400 text-sm italic">None identified.</p>
                    )}
                </Section>

                {/* Important Dates */}
                <Section title="Important Dates &amp; Deadlines" colorClass="text-emerald-700">
                    {analysisResult.important_dates_or_deadlines?.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-2 text-slate-700">
                            {analysisResult.important_dates_or_deadlines.map((item) => (
                                <li key={item.slice(0, 40)}>{item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400 text-sm italic">None identified.</p>
                    )}
                </Section>
            </div>

            {/* Risky Clauses */}
            <Section title="Risky or Unusual Clauses" colorClass="text-rose-700">
                {analysisResult.risky_or_unusual_clauses?.length > 0 ? (
                    <div className="space-y-4">
                        {analysisResult.risky_or_unusual_clauses.map((clause, i) => {
                            const style = RISK_STYLES[clause.risk_level] ?? RISK_STYLES.low;
                            return (
                                <div
                                    key={clause.clause_text?.slice(0, 40) ?? i}
                                    className={`p-4 border-l-4 rounded bg-slate-50 ${style.border}`}
                                >
                                    <p className="font-medium text-slate-800">"{clause.clause_text}"</p>
                                    <p className="text-slate-600 mt-2 text-sm">
                                        <span className="font-semibold">Why it matters:</span>{' '}
                                        {clause.why_it_matters}
                                    </p>
                                    {/* Badge includes text label so risk level isn't communicated by colour alone */}
                                    <span
                                        className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${style.badge}`}
                                        aria-label={style.label}
                                    >
                                        {style.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-slate-400 text-sm italic">No risky clauses identified.</p>
                )}
            </Section>

            {/* Missing Terms */}
            <Section title="Missing or Unclear Terms" colorClass="text-amber-700">
                {analysisResult.missing_or_unclear_terms?.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2 text-slate-700">
                        {analysisResult.missing_or_unclear_terms.map((item) => (
                            <li key={item.slice(0, 40)}>{item}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-400 text-sm italic">No missing or unclear terms identified.</p>
                )}
            </Section>
        </div>
    );
}
