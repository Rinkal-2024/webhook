const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Gitlab } = require('@gitbeaker/node');

const app = express();
const PORT = 8000;
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const gitlab = new Gitlab({
    token: process.env.GITLAB_TOKEN,
});

app.use(cors());
app.use(bodyParser.json());

app.post('/generate-suggestions', async (req, res) => {
    const { projectId, mergeRequestId } = req.body;

    if (!projectId || !mergeRequestId) {
        return res.status(400).json({ error: 'Project ID and Merge Request ID are required' });
    }

    try {
        // Fetch the merge request details
        const mergeRequest = await gitlab.MergeRequests.show(projectId, mergeRequestId);
        const diff = await gitlab.MergeRequests.diff(projectId, mergeRequestId);

        // Extract previous code from the diff
        const previousCode = diff.map(file => file.diff).join('\n');

        // Generate code suggestions based on previous code
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([previousCode]);

        if (result.response && result.response.candidates && result.response.candidates.length > 0) {
            const generatedContent = result.response.candidates[0];
            const generatedText = generatedContent.content.parts[0].text;

            return res.json({ suggestions: generatedText });
        }

        return res.status(500).json({ error: 'No valid candidates returned' });
    } catch (error) {
        console.error('Error generating suggestions:', error);
        return res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
