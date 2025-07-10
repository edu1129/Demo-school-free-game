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

const GAS_URL2 = process.env.GAS_URL2;
const GAS_URL3 = process.env.GAS_URL3;
const GAS_URL4 = process.env.GAS_URL4;
const GAS_URL5 = process.env.GAS_URL5;
const GAS_URL6 = process.env.GAS_URL6;

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

app.get('/view.html', (req, res) => {
    const viewPath = path.join(__dirname, 'view.html');
    res.sendFile(viewPath, (err) => {
        if (err) {
            console.error("Error sending view.html:", err);
            if (!res.headersSent) {
                res.status(404).send("File not found.");
            }
        }
    });
});
app.get('/results.html', (req, res) => {
    const resultsPath = path.join(__dirname, 'results.html');
    res.sendFile(resultsPath, (err) => {
        if (err) {
            console.error("Error sending results.html:", err);
            if (!res.headersSent) {
                res.status(404).send("File not found.");
            }
        }
    });
});

app.get('/list.html', (req, res) => {
    const listPath = path.join(__dirname, 'list.html');
    res.sendFile(listPath, (err) => {
        if (err) {
            console.error("Error sending list.html:", err);
            if (!res.headersSent) {
                res.status(404).send("File not found.");
            }
        }
    });
});

app.get('/password.html', (req, res) => {
    const listPath = path.join(__dirname, 'password.html');
    res.sendFile(listPath, (err) => {
        if (err) {
            console.error("Error sending list.html:", err);
            if (!res.headersSent) {
                res.status(404).send("File not found.");
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


// New proxy endpoint for the second GAS script
app.post('/api2', async (req, res) => {
    if (!GAS_URL2) {
        console.error("FATAL ERROR: GAS_URL2 environment variable is not set.");
        return res.status(500).json({ success: false, error: 'Server is not configured for this endpoint.' });
    }

    const { action, payload } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required in the request body' });
    }
    
    console.log(`Proxy2 received action: ${action}`);
    
    try {
        const gasResponse = await fetch(GAS_URL2, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action, payload })
        });
        
        const responseBodyText = await gasResponse.text();
        let result;
        
        try {
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            console.error(`Failed to parse GAS JSON response for action "${action}" from GAS_URL2. Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500));
            if (gasResponse.ok) {
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500)
                });
            }
        }
        
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy2 fetch error for action "${action}":`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during action: ${action}`,
            details: error.message
        });
    }
});

// New proxy endpoint for the third GAS script (data viewer)
app.post('/api3', async (req, res) => {
    if (!GAS_URL3) {
        console.error("FATAL ERROR: GAS_URL3 environment variable is not set.");
        return res.status(500).json({ success: false, error: 'Server is not configured for this endpoint.' });
    }

    const { payload } = req.body; // This endpoint might not use 'action'
    
    console.log(`Proxy3 received request`);
    
    try {
        const gasResponse = await fetch(GAS_URL3, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ payload })
        });
        
        const responseBodyText = await gasResponse.text();
        let result;
        
        try {
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            console.error(`Failed to parse GAS JSON response from GAS_URL3. Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500));
            if (gasResponse.ok) {
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500)
                });
            }
        }
        
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy3 fetch error:`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during request`,
            details: error.message
        });
    }
});

// New proxy endpoint for the fourth GAS script (results viewer)
app.post('/api4', async (req, res) => {
    if (!GAS_URL4) {
        console.error("FATAL ERROR: GAS_URL4 environment variable is not set.");
        return res.status(500).json({ success: false, error: 'Server is not configured for this endpoint.' });
    }

    const { action, payload } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required in the request body' });
    }
    
    console.log(`Proxy4 received action: ${action}`);
    
    try {
        const gasResponse = await fetch(GAS_URL4, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action, payload })
        });
        
        const responseBodyText = await gasResponse.text();
        let result;
        
        try {
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            console.error(`Failed to parse GAS JSON response from GAS_URL4. Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500));
            if (gasResponse.ok) {
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500)
                });
            }
        }
        
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy4 fetch error:`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during request`,
            details: error.message
        });
    }
});

// New proxy endpoint for the fifth GAS script (password reset)
app.post('/api5', async (req, res) => {
    if (!GAS_URL5) {
        console.error("FATAL ERROR: GAS_URL5 environment variable is not set.");
        return res.status(500).json({ success: false, error: 'Server is not configured for this endpoint.' });
    }

    const { action, payload } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required in the request body' });
    }
    
    console.log(`Proxy5 received action: ${action}`);
    
    try {
        const gasResponse = await fetch(GAS_URL5, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action, payload })
        });
        
        const responseBodyText = await gasResponse.text();
        let result;
        
        try {
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            console.error(`Failed to parse GAS JSON response from GAS_URL5. Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500));
            if (gasResponse.ok) {
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500)
                });
            }
        }
        
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy5 fetch error:`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during request`,
            details: error.message
        });
    }
});

// New proxy endpoint for the sixth GAS script (class management)
app.post('/api6', async (req, res) => {
    if (!GAS_URL6) {
        console.error("FATAL ERROR: GAS_URL6 environment variable is not set.");
        return res.status(500).json({ success: false, error: 'Server is not configured for this endpoint.' });
    }

    const { action, payload } = req.body;
    
    if (!action) {
        return res.status(400).json({ success: false, error: 'Action is required in the request body' });
    }
    
    console.log(`Proxy6 received action: ${action}`);
    
    try {
        const gasResponse = await fetch(GAS_URL6, {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({ action, payload })
        });
        
        const responseBodyText = await gasResponse.text();
        let result;
        
        try {
            result = JSON.parse(responseBodyText);
        } catch (parseError) {
            console.error(`Failed to parse GAS JSON response from GAS_URL6. Status: ${gasResponse.status}. Body:`, responseBodyText.substring(0, 500));
            if (gasResponse.ok) {
                return res.status(200).json({ success: true, message: 'Operation successful (non-JSON response)', rawResponse: responseBodyText });
            } else {
                return res.status(gasResponse.status).json({
                    success: false,
                    error: `Upstream GAS error (Status: ${gasResponse.status}, Non-JSON response)`,
                    details: responseBodyText.substring(0, 500)
                });
            }
        }
        
        res.status(gasResponse.status).json(result);
        
    } catch (error) {
        console.error(`API proxy6 fetch error:`, error);
        res.status(500).json({
            success: false,
            error: `Proxy server internal error during request`,
            details: error.message
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
