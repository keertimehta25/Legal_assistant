import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComparePage from './ComparePage';
import { SessionProvider } from '../context/SessionContext';

vi.mock('../api/client', () => ({
    uploadDocument: vi.fn(),
    compareDocuments: vi.fn(),
}));

import * as api from '../api/client';

function renderPage() {
    return render(
        <SessionProvider>
            <ComparePage />
        </SessionProvider>
    );
}

describe('ComparePage', () => {
    beforeEach(() => vi.clearAllMocks());

    test('disables the compare button until both documents are provided', () => {
        renderPage();
        expect(screen.getByRole('button', { name: /compare documents/i })).toBeDisabled();
    });

    test('uploads both documents and renders comparison results grouped by topic', async () => {
        api.uploadDocument
            .mockResolvedValueOnce({ text: 'Document A full text' })
            .mockResolvedValueOnce({ text: 'Document B full text' });
        api.compareDocuments.mockResolvedValue({
            topics: [
                {
                    topic_name: 'Payment',
                    differences: [
                        { description: 'Doc B pays less', more_favorable_doc: 'A', reason: 'Lower fee in B' },
                    ],
                    missing_clauses: [],
                },
            ],
        });

        renderPage();
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const fileA = new File(['dummy'], 'contractA.pdf', { type: 'application/pdf' });
        const fileB = new File(['dummy'], 'contractB.pdf', { type: 'application/pdf' });

        fireEvent.change(fileInputs[0], { target: { files: [fileA] } });
        await waitFor(() => expect(api.uploadDocument).toHaveBeenCalledWith(fileA));

        fireEvent.change(fileInputs[1], { target: { files: [fileB] } });
        await waitFor(() => expect(api.uploadDocument).toHaveBeenCalledWith(fileB));

        const button = screen.getByRole('button', { name: /compare documents/i });
        await waitFor(() => expect(button).not.toBeDisabled());
        fireEvent.click(button);

        await waitFor(() => expect(screen.getByText('Payment')).toBeInTheDocument());
        expect(screen.getByText(/Doc B pays less/)).toBeInTheDocument();
        expect(screen.getByText(/Document A more favorable/i)).toBeInTheDocument();
    });
});
