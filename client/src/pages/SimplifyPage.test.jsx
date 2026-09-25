import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect as useReactEffect } from 'react';
import SimplifyPage from './SimplifyPage';
import { SessionProvider, useSession } from '../context/SessionContext';

vi.mock('../api/client', () => ({
    simplifyText: vi.fn(),
}));

import * as api from '../api/client';

// Seeds session context with a document (in an effect, after mount) so the
// page renders its main UI instead of the "no document uploaded" empty state.
function Seed({ children }) {
    const { setDocumentText } = useSession();
    useReactEffect(() => {
        setDocumentText('This is the original legal text.');
    }, [setDocumentText]);
    return children;
}

function renderPage() {
    return render(
        <SessionProvider>
            <Seed>
                <SimplifyPage />
            </Seed>
        </SessionProvider>
    );
}

describe('SimplifyPage', () => {
    beforeEach(() => vi.clearAllMocks());

    test('shows an empty state when no document has been uploaded', () => {
        render(
            <SessionProvider>
                <SimplifyPage />
            </SessionProvider>
        );
        expect(screen.getByRole('status')).toHaveTextContent(/no document uploaded/i);
    });

    test('lets the user pick a reading level and view the simplified result', async () => {
        api.simplifyText.mockResolvedValue({ simplifiedText: 'Plain-language version of the document.' });

        renderPage();

        fireEvent.change(screen.getByLabelText(/reading level/i), { target: { value: '8th grade' } });
        fireEvent.click(screen.getByRole('button', { name: /simplify document/i }));

        await waitFor(() =>
            expect(api.simplifyText).toHaveBeenCalledWith('This is the original legal text.', '8th grade')
        );
        expect(await screen.findByText('Plain-language version of the document.')).toBeInTheDocument();
    });

    test('shows an error message if simplification fails', async () => {
        api.simplifyText.mockRejectedValue(new Error('AI service is busy.'));

        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /simplify document/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent('AI service is busy.');
    });
});
