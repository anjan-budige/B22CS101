require('dotenv').config();

const LOG_URL = process.env.LOG_URL;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

function Log(stack, level, packageName, message) {
    const data = {
        stack: stack.toLowerCase(),
        level: level.toLowerCase(),
        package: packageName.toLowerCase(),
        message: message
    };

    fetch(LOG_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${BEARER_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Log sent:', result);
    })
    .catch(error => {
        console.error('Log failed:', error.message);
    });
}

function loggingMiddleware(req, res, next) {
    const start = Date.now();

    Log('backend', 'info', 'middleware', `${req.method} ${req.path}`);

    const originalEnd = res.end;
    res.end = function(...args) {
        const time = Date.now() - start;
        const status = res.statusCode;

        if (status >= 400) {
            Log('backend', 'error', 'handler', `${req.method} ${req.path} - Error ${status}`);
        } else {
            Log('backend', 'info', 'handler', `${req.method} ${req.path} - Success ${status}`);
        }

        originalEnd.apply(this, args);
    };

    next();
}

module.exports = { Log, loggingMiddleware };
