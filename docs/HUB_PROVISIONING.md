# Hub → Marketplace Provisioning API

This document specifies how the legacy **PHP Hub** provisions tenants (Business + domain + sales channel + publishable API key) in the Marketplace.

## Endpoint

`POST /admin/hub/provision`

## Authentication (HMAC)

The request must include:

- `X-Hub-Timestamp`: unix seconds or milliseconds
- `X-Hub-Signature`: hex digest, either raw hex or `sha256=<hex>`

The server computes:

1. `canonicalBody = stableStringify(jsonBody)` (keys sorted recursively)
2. `message = "<timestampMs>.<canonicalBody>"`
3. `expected = HMAC_SHA256_HEX(HUB_PROVISIONING_SECRET, message)`

The request is accepted if `expected == X-Hub-Signature` and the timestamp is within ±5 minutes.

### Required server env vars

- `HUB_PROVISIONING_SECRET` (required)
- `TENANT_PLATFORM_BASE_DOMAIN` (optional, default `therxspot.com`)

## Request body (strict contract)

```json
{
  "schema_version": 1,
  "handle": "best-health",
  "business_name": "Best Health",
  "owner_email": "owner@besthealth.com",
  "logo_url": "https://...",
  "primary_color": "#2A4B5C",
  "secondary_color": "#00B4A0"
}
```

Notes:
- Unknown keys are rejected.
- `handle` is the primary idempotency key (slug). Replaying the same request is safe (the endpoint returns 200 with `idempotent: true`).

## Response

```json
{
  "business": { "id": "bus_...", "slug": "best-health", "status": "active" },
  "business_id": "bus_...",
  "sales_channel_id": "sc_...",
  "publishable_api_key_id": "apk_...",
  "publishable_api_key_token": "pk_...",
  "storefront_url": "https://best-health.therxspot.com"
}
```

## PHP reference implementation (signature)

This must match the server’s canonical JSON ordering (`stableStringify`).

```php
<?php
function stable_stringify($value) {
  if (is_array($value)) {
    $isAssoc = array_keys($value) !== range(0, count($value) - 1);
    if ($isAssoc) {
      ksort($value);
      $parts = [];
      foreach ($value as $k => $v) {
        $parts[] = json_encode((string)$k) . ":" . stable_stringify($v);
      }
      return "{" . implode(",", $parts) . "}";
    } else {
      $parts = array_map("stable_stringify", $value);
      return "[" . implode(",", $parts) . "]";
    }
  }

  if (is_object($value)) {
    return stable_stringify((array)$value);
  }

  return json_encode($value);
}

$secret = getenv("HUB_PROVISIONING_SECRET");
$timestampMs = (int) round(microtime(true) * 1000);
$body = [
  "schema_version" => 1,
  "handle" => "best-health",
  "business_name" => "Best Health",
  "owner_email" => "owner@besthealth.com"
];

$canonicalBody = stable_stringify($body);
$message = $timestampMs . "." . $canonicalBody;
$sig = hash_hmac("sha256", $message, $secret);

// Send headers:
// X-Hub-Timestamp: $timestampMs
// X-Hub-Signature: sha256=$sig
?>
```

