/**
 * Tempest Weather API Proxy — Read-only
 * Netlify serverless function at /.netlify/functions/tempest
 *
 * All Tempest calls are made server-side so the personal token never
 * appears in the browser.
 *
 * Environment variable required:
 *   TEMPEST_TOKEN  — your Tempest personal access token
 *                    (tempestwx.com → Settings → Data Authorizations → Create Token)
 *
 * Supported ?endpoint= values:
 *   stations                           — list all stations + devices
 *   observations/station/{station_id}  — latest observation for a station
 *   better_forecast                    — 7-day forecast (requires &station_id=N)
 *
 * All other query params (station_id, device_id, units_*) are forwarded as-is.
 */

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Read-only proxy — GET only.' }) };
  }

  const token = process.env.TEMPEST_TOKEN;
  if (!token) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'TEMPEST_TOKEN environment variable not set.' }) };
  }

  const params = event.queryStringParameters || {};
  const endpoint = params.endpoint;
  if (!endpoint) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing ?endpoint= parameter.' }) };
  }

  // Whitelist — only read endpoints we actually use
  const ALLOWED = [
    /^stations$/,
    /^observations\/station\/\d+$/,
    /^observations$/,                  // device observations (?device_id=N)
    /^better_forecast$/,
  ];
  if (!ALLOWED.some(re => re.test(endpoint))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: `Endpoint not permitted: ${endpoint}` }) };
  }

  // Forward all query params except 'endpoint', inject token
  const forward = { ...params, token };
  delete forward.endpoint;
  const qs = new URLSearchParams(forward).toString();
  const url = `https://swd.weatherflow.com/swd/rest/${endpoint}?${qs}`;

  try {
    const resp = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    const body = await resp.text();
    if (!resp.ok) {
      return { statusCode: resp.status, headers: CORS, body: JSON.stringify({ error: `Tempest API ${resp.status}`, detail: body }) };
    }
    return { statusCode: 200, headers: CORS, body };
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Failed to reach Tempest API', detail: err.message }) };
  }
};
