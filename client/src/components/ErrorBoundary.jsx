import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('LegalLens crashed:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-6">
                    <div className="max-w-md text-center">
                        <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
                        <p className="text-slate-400 mb-6">
                            LegalLens hit an unexpected error. Try refreshing the page. If it persists,
                            your document may have been too large or in an unsupported format.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition"
                        >
                            Reload page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
