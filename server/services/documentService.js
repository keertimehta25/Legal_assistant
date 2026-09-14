import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
import fs from 'fs/promises';

export const extractTextFromFile = async (file) => {
    try {
        const filePath = file.path;
        let text = '';

        if (file.mimetype === 'application/pdf') {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            text = data.text;
        } else if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.originalname.endsWith('.docx')
        ) {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else {
            throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
        }

        // Clean up the temporary file
        await fs.unlink(filePath);
        return text;
    } catch (error) {
        throw new Error(`Failed to extract text: ${error.message}`);
    }
};
