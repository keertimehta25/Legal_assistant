import fs from 'fs/promises';
// Import pdf-parse's real implementation directly (lib/pdf-parse.js), NOT the
// package's index.js. index.js has a leftover debug block guarded by
// `!module.parent` intended to only run when the file is executed directly -
// but that check misfires when required from an ES module context (this
// file), causing it to crash on startup trying to read a nonexistent sample
// PDF. lib/pdf-parse.js is the actual parser with no such side effect.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

const MAX_EXTRACTED_CHARS = 200_000; // guard against blowing model context limits

export const extractTextFromFile = async (file) => {
    const filePath = file.path;
    try {
        let text = '';

        if (file.mimetype === 'application/pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            text = data.text;
        } else if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.originalname.toLowerCase().endsWith('.docx')
        ) {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else {
            throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
        }

        if (!text || !text.trim()) {
            throw new Error(
                'No extractable text found in this document. It may be a scanned image without a ' +
                'text layer - try a text-based PDF or DOCX instead.'
            );
        }

        if (text.length > MAX_EXTRACTED_CHARS) {
            console.warn(`[documentService] Truncating extracted text from ${text.length} to ${MAX_EXTRACTED_CHARS} chars`);
            text = text.slice(0, MAX_EXTRACTED_CHARS);
        }

        return text;
    } catch (error) {
        throw new Error(`Failed to extract text: ${error.message}`);
    } finally {
        // Always clean up the temp upload, even if extraction failed
        await fs.unlink(filePath).catch(() => {});
    }
};
