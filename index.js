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

app.post('/generate-code', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([prompt]);

        console.log('API Response:', JSON.stringify(result));

        if (result.response && result.response.candidates && result.response.candidates.length > 0) {
            const generatedContent = result.response.candidates[0];
            const generatedText = generatedContent.content.parts[0].text;

            const codeOnly = generatedText.split('**Explanation:**')[0].trim();
            const cleanedCode = codeOnly.replace(/```python|```|```javascript/g, '').trim();

            
            const projectId = '871';
            const branch = 'main'; 
            const commitMessage = 'Add generated code';

            await gitlab.Commits.create(projectId, {
                branch,
                commitMessage,
                actions: [{
                    action: 'create',
                    filePath: 'generated_code.js', 
                    content: cleanedCode,
                }],
            });
            

            return res.json({ code: cleanedCode });
        }

        return res.status(500).json({ error: 'No valid candidates returned' });
    } catch (error) {
        console.error('Error generating code:', error);
        return res.status(500).json({ error: 'Failed to generate code' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
