const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Load variables from .env file
const app = express();

// Use PORT from environment variables or default to 9000
const PORT = process.env.PORT || 9000;

app.use(express.json());

// Simple GET route for testing
app.get('/', (req, res) => {
    res.send("hello");
});

// Webhook endpoint for GitLab events
app.post('/webhook', async (req, res) => {
    try {
        const event = req.body;

        // Process the GitLab event (e.g., issue creation)
        if (event.object_kind === 'issue' && event.object_attributes.action === 'open') {
            const issueTitle = event.object_attributes.title;
            const issueDescription = event.object_attributes.description;

            // Call the OpenAI API
            const chatGptResponse = await getChatGptResponse(issueTitle, issueDescription);
            
            // Post the response back to GitLab as a comment
            await postCommentToGitLab(event.object_attributes.project_id, event.object_attributes.id, chatGptResponse);
        }

        res.status(200).send('Webhook received');
    } catch (error) {
        console.error('Error handling webhook:', error); 
    }
});

// Function to call the OpenAI                                                                                                                                                                                                                                                                                                                                                      
async function getChatGptResponse(title, description) {
    const data = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Provide insights on this issue: ${title} - ${description}` }]
    };
    
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 2000; // Start with 2 seconds

    while (attempts < maxAttempts) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', data, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // Set a higher timeout if necessary
            });
            return response.data.choices[0].message.content;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                attempts++;
                const delayTime = baseDelay * Math.pow(2, attempts); // Exponential backoff
                console.warn(`Rate limit exceeded. Attempt ${attempts} of ${maxAttempts}. Retrying in ${delayTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayTime)); 
            } else {
                console.error('Error calling OpenAI API:', error);
                throw error; 
            }
        }
    }
    
    throw new Error('Max retry attempts reached');
}



// Function to post a comment to GitLab
async function postCommentToGitLab(projectId, issueId, comment) {
    await axios.post(`https://gitlab.com/api/v4/projects/${projectId}/issues/${issueId}/notes`, {
        body: comment
    }, {
        headers: {
            'Private-Token': process.env.GITLAB_PRIVATE_TOKEN // Use environment variable
        }
    });
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
