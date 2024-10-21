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
    host: process.env.GITLAB_HOST,
});

app.use(cors());
app.use(bodyParser.json());

app.get('/',(req,res) =>{
    res.send('Hello, GitOps with GitLab and Generative AI!');
})
// Webhook endpoint for merge request events
app.post('/webhook', async (req, res) => {
    const event = req.headers['x-gitlab-event'];

    if (event === 'Merge Request Hook') {
        const { project_id, object_attributes } = req.body;
        const mergeRequestId = object_attributes.id;

        try {
            // Fetch the merge request details
            const mergeRequest = await gitlab.MergeRequests.show(project_id, mergeRequestId);

            // Fetch the changes in the merge request
            const changes = await gitlab.MergeRequests.changes(project_id, mergeRequestId);
            
            // Extract previous code from the changes
            const previousCode = changes.changes
                .map(change => change.diff)
                .filter(diff => diff)
                .join('\n');

            console.log('Previous Code:', previousCode);

            // Generate code suggestions based on previous code
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent([previousCode]);

            if (result.response && result.response.candidates && result.response.candidates.length > 0) {
                const generatedContent = result.response.candidates[0];
                const generatedText = generatedContent.content.parts[0].text;

                // Optional: Comment on the merge request with suggestions
                await gitlab.MergeRequests.notes.create(project_id, mergeRequestId, {
                    body: `Here are some suggestions for improving your code:\n\n${generatedText}`
                });

                return res.json({ suggestions: generatedText });
            }

            return res.status(500).json({ error: 'No valid candidates returned' });
        } catch (error) {
            console.error('Error processing merge request:', error);
            return res.status(500).json({ error: 'Failed to process merge request' });
        }
    }

    // Respond to GitLab
    res.status(200).send('Webhook received');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
