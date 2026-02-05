<?php
/**
 * HubProvisioningClient
 *
 * Purpose: PHP Hub -> Medusa Engine tenant provisioning bridge.
 *
 * This file is intended to be copied into the PHP Hub codebase.
 *
 * Contract:
 * - POST {MEDUSA_BASE_URL}/admin/hub/provision
 * - HMAC SHA-256 signature over: "{timestampMs}.{stableJson(body)}"
 * - Headers:
 *   - X-Hub-Timestamp: unix ms (preferred)
 *   - X-Hub-Signature: "sha256=<hex>"
 */

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

function hub_provision_tenant($medusaBaseUrl, $secret, $payload) {
  if (!$medusaBaseUrl) throw new Exception("medusaBaseUrl is required");
  if (!$secret) throw new Exception("secret is required");
  if (!is_array($payload)) throw new Exception("payload must be an associative array");

  $timestampMs = (int) round(microtime(true) * 1000);
  $canonicalBody = stable_stringify($payload);
  $message = $timestampMs . "." . $canonicalBody;
  $sig = hash_hmac("sha256", $message, $secret);

  $url = rtrim($medusaBaseUrl, "/") . "/admin/hub/provision";

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
  curl_setopt($ch, CURLOPT_POSTFIELDS, $canonicalBody);
  curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "X-Hub-Timestamp: " . $timestampMs,
    "X-Hub-Signature: sha256=" . $sig,
  ]);

  $respBody = curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = curl_error($ch);
  curl_close($ch);

  if ($respBody === false) {
    throw new Exception("curl error: " . $err);
  }

  $decoded = json_decode($respBody, true);
  if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    throw new Exception("invalid JSON response (" . $httpCode . "): " . $respBody);
  }

  if ($httpCode < 200 || $httpCode >= 300) {
    $msg = isset($decoded["message"]) ? $decoded["message"] : "request failed";
    throw new Exception("hub provision failed (" . $httpCode . "): " . $msg);
  }

  return $decoded;
}

/**
 * Example usage:
 *
 * $res = hub_provision_tenant(
 *   getenv("MEDUSA_BASE_URL"),
 *   getenv("HUB_PROVISIONING_SECRET"),
 *   [
 *     "schema_version" => 1,
 *     "handle" => "best-health",
 *     "business_name" => "Best Health",
 *     "owner_email" => "owner@besthealth.com",
 *   ]
 * );
 *
 * // Persist these in your Hub DB for the tenant:
 * // - $res["business_id"]
 * // - $res["sales_channel_id"]
 * // - $res["publishable_api_key_token"]
 * // - $res["storefront_url"]
 */

