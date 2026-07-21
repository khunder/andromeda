# CORS Solution for Andromeda Engine Deployment

## Problem
When deploying BPMN diagrams from the browser to the Andromeda engine, you may encounter CORS (Cross-Origin Resource Sharing) errors. This happens because browsers enforce security policies that prevent web pages from making requests to different origins.

## Solutions

### 1. Configure CORS on Andromeda Engine (Recommended)

Add CORS headers to your Andromeda engine API. If using Python/Flask:

```python
from flask_cors import CORS

# Enable CORS for all routes
CORS(app)

# Or configure specific origins
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])
```

Or add headers manually:

```python
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response
```

### 2. Use a Proxy Server

Create a simple proxy server that forwards requests:

```javascript
// proxy-server.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(cors());

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
}));

app.listen(3001, () => {
  console.log('Proxy server running on http://localhost:3001');
});
```

Then configure the designer to use `http://localhost:3001` as the engine URL.

### 3. Use Browser Extension (Development Only)

For development, you can use browser extensions like:
- "CORS Unblock" for Chrome
- "CORS Everywhere" for Firefox

**Note:** This should only be used for development, not production.

### 4. Run Designer and Engine on Same Origin

Deploy both the designer and engine on the same domain/port to avoid CORS issues entirely.

### 5. Configure Vite Dev Server Proxy (Development)

Add proxy configuration to `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});
```

## Testing CORS Configuration

Use the test button in the configuration panel to verify CORS is properly configured:

1. Click the ⚙️ button in the toolbar
2. Enter your engine URL
3. Click "Test Connection"
4. If successful, CORS is configured correctly

## Deployment Configuration

When deploying to production:

1. Set proper CORS origins (not `*`)
2. Use HTTPS for both designer and engine
3. Configure authentication headers if needed
4. Set appropriate CORS max age for caching

## Example Headers for Andromeda Engine

```
Access-Control-Allow-Origin: https://your-designer-domain.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept
Access-Control-Max-Age: 86400
```
