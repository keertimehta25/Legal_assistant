import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';

export default function ChecklistPage() {
    const { analysisResult } = useSession();
    const [checklist, setChecklist] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/checklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ analysisResult })
            });
            const data = await res.json();
            setChecklist(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (!analysisResult) {
        return <div className="text-center mt-20 text-slate-500">No document analyzed yet.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-800 mb-8">Action Checklist</h2>
            
            {!checklist && !loading && (
                <button 
                    onClick={handleGenerate}
                    className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition"
                >
                    Generate Checklist & Questions for Lawyer
                </button>
            )}
            
            {loading && <p className="animate-pulse text-slate-500">Generating...</p>}

            {checklist && (
                <div className="grid md:grid-cols-2 gap-8 mt-8">
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                        <h3 className="text-xl font-semibold mb-4 text-slate-800">Your Action Items</h3>
                        <ul className="space-y-3">
                            {checklist.action_checklist?.map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <input type="checkbox" className="mt-1 w-5 h-5 text-blue-600 rounded" />
                                    <span className="text-slate-700">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl shadow border border-slate-700 text-white">
                        <h3 className="text-xl font-semibold mb-4 text-blue-300">Questions for your Lawyer</h3>
                        <ul className="list-disc pl-5 space-y-3 text-slate-300">
                            {checklist.questions_for_lawyer?.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
