import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';

const MAX_EXTRACTED_CHARS = 200_000; // guard against blowing model context limits

/**
 * Fallback PDF text extraction using pdfjs-dist for PDFs with corrupted / bad XRef tables
 */
async function parsePdfWithPdfJsFallback(dataBuffer) {
    // Dynamically import pdfjs-dist legacy build (Node.js compatible)
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
    const uint8Array = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdfDocument = await loadingTask.promise;
    
    const pageTexts = [];
    for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const tokenizedText = await page.getTextContent();
        const pageText = tokenizedText.items.map((item) => item.str).join(' ');
        pageTexts.push(pageText);
    }
    return pageTexts.join('\n');
}

export const extractTextFromFile = async (file) => {
    const filePath = file.path;
    try {
        let text = '';

        if (file.mimetype === 'application/pdf') {
            const dataBuffer = await fs.readFile(filePath);
            try {
                // Primary parser: fast & lightweight
                const data = await pdfParse(dataBuffer);
                text = data.text;
            } catch (primaryErr) {
                console.warn(`[documentService] Primary pdf-parse failed (${primaryErr?.message || primaryErr}). Trying pdfjs-dist fallback...`);
                try {
                    // Fallback parser: robust against bad XRef tables / non-standard structures
                    text = await parsePdfWithPdfJsFallback(dataBuffer);
                } catch (fallbackErr) {
                    console.error('[documentService] Fallback pdfjs-dist parser also failed:', fallbackErr?.message || fallbackErr);
                    throw primaryErr; // Rethrow primary error if fallback also fails
                }
            }
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
        const errMsg = error?.message || String(error);
        if (errMsg.includes('XRef') || errMsg.includes('Invalid PDF structure')) {
            throw new Error('Unable to extract text from this PDF because it has a corrupted or non-standard structure (bad XRef). Please try resaving or converting the PDF.');
        }
        throw new Error(`Failed to extract text: ${errMsg}`);
    } finally {
        // Always clean up the temp upload, even if extraction failed
        await fs.unlink(filePath).catch(() => {});
    }
};
