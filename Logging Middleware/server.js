require('dotenv').config();
const express = require('express');
const { Log, loggingMiddleware } = require('./logger'); // Adjust path if needed

const app = express();
const router = express.Router();

app.use(express.json());
app.use(loggingMiddleware); // Use logging middleware globally

router.get('/', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token === process.env.BEARER_TOKEN) {
        res.json({ message: "Middleware Logger working fine" });
    } else {
        res.status(401).json({ error: "Bearer not correct" });
    }
});

app.use('/', router);

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});


router.post('/log', (req, res) => {
    try {
        const { stack, level, package, message } = req.body
        
        if (!stack || !level || !package || !message) {
            return res.status(400).json({ error: 'Missing required fields' })
        }
        
        Log(stack, level, package, message)
        console.log(`Received log: [${level.toUpperCase()}] ${stack}/${package} - ${message}`)
        
        res.json({ 
            message: 'Log received and sent to test server successfully',
            logID: Date.now().toString()
        })
    } catch (error) {
        console.error('Error processing log:', error)
        res.status(500).json({ error: 'Failed to process log' })
    }
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    Log('backend', 'info', 'service', `Log service started on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
});
