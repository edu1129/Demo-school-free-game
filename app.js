// app.js
const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
// Increase limit for potentially large base64 image data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const GAS_URL = process.env.GAS_URL;

// Validate GAS_URL at startup
if (!GAS_URL || !GAS_URL.startsWith('https://script.google.com/')) {
    console.error("FATAL ERROR: Invalid or missing GAS_URL environment variable.");
    console.error("Received:", GAS_URL); // Log the value received for debugging
    process.exit(1); // Exit if the URL is invalid or missing
}

// Serve the static frontend file
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error("Error sending index.html:", err);
            if (!res.headersSent) {
                res.status(500).send("Error loading application interface.");
            }
        }
    });
});

// Central API proxy endpoint
app.post('/api', async (req, res) => {
    // Expecting { action: 'actionName', payload: { ... } } in the request body
    const { action, payload } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required in the request body' });
    }
    
    // Log the received action and keys of the payload for debugging
    console.log(`Proxy received action: ${action}`);
    // console.log(`Proxy received payload keys: ${payload ? Object.keys(payload) : 'No Payload'}`); // Optional detailed logging
    
    try {
        const gasResponse = await fetch(GAS_URL, {
            method: 'POST',
            credentials: 'omit', // Important for CORS and server-to-server
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // GAS usually expects plain text
            },
            // GAS doPost(e) expects the entire stringified object
            body: JSON.stringify({ action, payload }) // Pass the entire structure
        });
        
        const responseBodyText = await gasResponse.text(); // Read body first as text
        let result;
        
        try {
            // Attempt to parse the text response as JSON
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            // If parsing fails, the response might be plain text or HTML (e.g., GAS error page)
            console.error(`Failed to parse GAS JSON response for action "${action}". Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500)); // Log first part of response
            
            // Check if the status code itself indicates success (2xx) despite non-JSON body
            if (gasResponse.ok) {
                // If GAS returned 2xx status but non-JSON, maybe it's a simple success text message?
                // Return success but include the text as message. Adjust if needed.
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                // If status is not OK and parsing failed, construct an error response
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500) // Include part of the raw response
                });
            }
        }
        
        // If JSON parsing was successful, forward the status code and parsed result
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy fetch error for action "${action}":`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during action: ${action}`,
            details: error.message // Provide error message for debugging
        });
    }
});


// Basic health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Catch-all for handling 404s for any routes not matched above
app.use((req, res) => {
    console.log(`404 Not Found: ${req.method} ${req.originalUrl}`);
    if (!res.headersSent) {
        res.status(404).send("Resource not found on this server.");
    }
});

// Global error handler (optional, catches unhandled errors in routes)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    if (!res.headersSent) {
        res.status(500).send("Internal Server Error");
    }
});


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Proxying requests to GAS URL: ${GAS_URL ? 'LOADED' : 'MISSING/INVALID!'}`); // Clearer log message
});
