import React, { createContext, useState, useContext } from 'react';

const SessionContext = createContext();

export const SessionProvider = ({ children }) => {
    // Generate a random session ID on mount
    const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
    
    // Store analysis result and document text (optional, to avoid re-uploading)
    const [documentText, setDocumentText] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [simplifiedText, setSimplifiedText] = useState(null);

    return (
        <SessionContext.Provider value={{
            sessionId,
            documentText, setDocumentText,
            analysisResult, setAnalysisResult,
            simplifiedText, setSimplifiedText
        }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => useContext(SessionContext);
