import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { generateChecklist } from '../api/client';

export default function ChecklistPage() {
    const { analysisResult } = useSession();
    const [checklist, setChecklist] = useState(null);
    const [checkedItems, setCheckedItems] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await generateChecklist(analysisResult);
            setChecklist(data);
            setCheckedItems({});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (i) => {
        setCheckedItems((prev) => ({ ...prev, [i]: !prev[i] }));
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

            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
                    {error}
                </div>
            )}

            {checklist && (
                <div className="grid md:grid-cols-2 gap-8 mt-8">
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                        <h3 className="text-xl font-semibold mb-4 text-slate-800">Your Action Items</h3>
                        <ul className="space-y-3">
                            {checklist.action_checklist?.map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <input
                                        id={`checklist-item-${i}`}
                                        type="checkbox"
                                        className="mt-1 w-5 h-5 text-blue-600 rounded"
                                        checked={!!checkedItems[i]}
                                        onChange={() => toggleItem(i)}
                                    />
                                    <label
                                        htmlFor={`checklist-item-${i}`}
                                        className={`text-slate-700 ${checkedItems[i] ? 'line-through text-slate-400' : ''}`}
                                    >
                                        {item}
                                    </label>
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
