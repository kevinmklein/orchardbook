/**
 * Rachio API Proxy — Read-only
 * Netlify serverless function at /.netlify/functions/rachio
 *
 * All Rachio calls are made server-side so the API key never
 * appears in the browser. Only GET endpoints are permitted.
 *
 * Environment variable required:
 *   RACHIO_API_KEY  — your Rachio API key (set in Netlify dashboard)
 *
 * Supported query params:
 *   ?endpoint=person/info              — authenticated user + devices + zones
 *   ?endpoint=device/:id               — single device with zones
 *   ?endpoint=schedulerule/device/:id  — all schedule rules for a device
 *   ?endpoint=zone/:id                 — single zone detail
 *   ?endpoint=device/:id/event         — recent device events (last-run history)
 *     optional: &startTime=<epoch_ms>&endTime=<epoch_ms>
 */

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // Only GET allowed — this proxy is read-only by design
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed. This proxy is read-only.' }) };
  }

  const apiKey = process.env.RACHIO_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'RACHIO_API_KEY environment variable not set in Netlify.' }) };
  }

  // Parse the requested endpoint from query string
  const params = event.queryStringParameters || {};
  const endpoint = params.endpoint;

  if (!endpoint) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing ?endpoint= parameter.' }) };
  }

  // Whitelist — only the read endpoints we actually use
  const ALLOWED = [
    /^person\/info$/,
    /^person\/[0-9a-f-]+$/,
    /^device\/[0-9a-f-]+$/,
    /^device\/[0-9a-f-]+\/event$/,
    /^schedulerule\/device\/[0-9a-f-]+$/,
    /^zone\/[0-9a-f-]+$/,
  ];

  const allowed = ALLOWED.some(re => re.test(endpoint));
  if (!allowed) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: `Endpoint not permitted: ${endpoint}` }) };
  }

  // Build full Rachio API URL, forwarding any extra query params (e.g. startTime/endTime)
  const base = 'https://api.rach.io/1/public';
  const extraParams = { ...params };
  delete extraParams.endpoint;
  const qs = Object.keys(extraParams).length
    ? '?' + new URLSearchParams(extraParams).toString()
    : '';
  const url = `${base}/${endpoint}${qs}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await resp.text();

    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: CORS,
        body: JSON.stringify({ error: `Rachio API error ${resp.status}`, detail: body }),
      };
    }

    return { statusCode: 200, headers: CORS, body };

  } catch (err) {
    return {
      statusCode: 502,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to reach Rachio API', detail: err.message }),
    };
  }
};
