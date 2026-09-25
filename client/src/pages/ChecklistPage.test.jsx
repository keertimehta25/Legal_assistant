import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import ChecklistPage from './ChecklistPage';
import { SessionProvider, useSession } from '../context/SessionContext';

vi.mock('../api/client', () => ({
    generateChecklist: vi.fn(),
}));

import * as api from '../api/client';

function Seed({ children }) {
    const { setAnalysisResult } = useSession();
    useEffect(() => {
        setAnalysisResult({ key_obligations: ['Pay rent monthly'] });
    }, [setAnalysisResult]);
    return children;
}

function renderPage() {
    return render(
        <SessionProvider>
            <Seed>
                <ChecklistPage />
            </Seed>
        </SessionProvider>
    );
}

describe('ChecklistPage', () => {
    beforeEach(() => vi.clearAllMocks());

    test('checkbox is associated with its label and stays checked when clicked', async () => {
        api.generateChecklist.mockResolvedValue({
            action_checklist: ['Review the termination clause'],
            questions_for_lawyer: ['What happens if I miss a payment?'],
        });

        renderPage();
        fireEvent.click(screen.getByRole('button', { name: /generate checklist/i }));

        const checkbox = await screen.findByRole('checkbox', { name: /review the termination clause/i });
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        await waitFor(() => expect(checkbox).toBeChecked());
    });
});
