# Replicate Integration (WIP)

## Status: Blocked by CORS

The Replicate integration is complete code-wise but **cannot work** in Figma plugins due to CORS restrictions.

## The Problem

Replicate's API (`api.replicate.com`) does not include CORS headers in its responses:

```
# No Access-Control-Allow-Origin header
curl -I -X OPTIONS "https://api.replicate.com/v1/predictions" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
```

Figma plugins run their UI in an iframe with origin `data:text/html;...`. When making fetch requests from this context, the browser enforces CORS. Without `Access-Control-Allow-Origin` headers from Replicate, all requests fail with:

```
Access to fetch at 'https://api.replicate.com/v1/predictions' from origin 'null'
has been blocked by CORS policy: Response to preflight request doesn't pass
access control check: No 'Access-Control-Allow-Origin' header is present on
the requested resource.
```

## Why OpenRouter Works

OpenRouter's API includes permissive CORS headers:

```
access-control-allow-origin: *
access-control-allow-methods: GET,OPTIONS,PATCH,DELETE,POST,PUT
```

This allows browser-based clients (like Figma plugins) to make requests directly.

## Implementation Details

The Replicate provider code is complete and tested via curl:

### Files Created/Modified

- `src/providers/replicate.ts` - Full implementation with polling
- `src/providers/generate.ts` - Dispatcher updated
- `src/providers/index.ts` - Provider config added
- `src/types/index.ts` - ProviderId union updated
- `package.json` - Network access domains added

### Model Configuration

- Model: `google/nano-banana-pro`
- Version: `dd58413c945870f8e6dc8204654079c60d577e76dc46a920c24dbe6a84a4cd9d`
- API: Async predictions with polling

### API Flow (tested working via curl)

1. POST `/v1/predictions` with version and input
2. Poll `GET /v1/predictions/{id}` until status is `succeeded`
3. Fetch image from output URL (`replicate.delivery`)

### Test Token

```
r8_9jVu280d2SITUPdDwu8VEbf6oCwYbxI1cLXMj
```

## Possible Solutions

1. **Wait for Replicate to add CORS** - Unlikely, their API is designed for server-side use
2. **Use a CORS proxy** - Security concern with API keys passing through third party
3. **Build a backend proxy** - Add a small server that proxies requests to Replicate
4. **Use Replicate's JS client with a backend** - Same as above

## Recommendation

For now, only support providers with CORS headers:
- ✅ OpenRouter (`access-control-allow-origin: *`)
- ✅ Fal.ai (`access-control-allow-origin` reflects origin)
- ❌ Replicate (no CORS)

## To Resume This Work

If Replicate adds CORS support in the future:

1. Check CORS headers: `curl -I -X OPTIONS "https://api.replicate.com/v1/predictions" -H "Origin: https://example.com"`
2. If `access-control-allow-origin` is present, the code should work as-is
3. Test in Figma plugin
