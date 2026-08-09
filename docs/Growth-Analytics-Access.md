# Growth Analyst access to GA4 and Search Console

This mechanism gives the Growth Analyst authenticated, read-only evidence. It
does not grant access to edit GA4, Search Console, the catalogue or production.

## One-time Google setup

1. Create a dedicated Google Cloud service account for SupplementScout growth
   reporting and enable the Google Analytics Data API and Search Console API.
2. Add the service-account email to the GA4 property with the `Viewer` role.
3. Add the same email as a read-only user of the verified Search Console
   property `sc-domain:supplementscout.co.uk`.
4. Create one JSON key, base64-encode the complete JSON without changing it,
   and store it as the `GOOGLE_SERVICE_ACCOUNT_JSON_B64` secret in the protected
   GitHub `production-readonly` environment. Never commit or paste the key into
   an issue, document, artifact or chat.
5. Add `GA4_PROPERTY_ID` and `GSC_SITE_URL` as environment variables in that
   GitHub environment. `GA4_PROPERTY_ID` is the numeric property ID, not the
   public `G-...` measurement ID. Set `GSC_SITE_URL` to
   `sc-domain:supplementscout.co.uk`.

Delete the downloaded key file after the GitHub secret has been confirmed. If
the key is ever exposed, revoke it in Google Cloud and replace the secret.

## Operation

The `Growth Analytics Report` workflow runs each Monday at 08:37 and 12:37 UTC and may
also be started manually. It requests only these OAuth scopes:

- `analytics.readonly`;
- `webmasters.readonly`.

The report is uploaded as a private GitHub Actions artifact for 35 days. It
contains the seven-day GSC totals, top queries and pages, URL-level inspection of
top pages plus homepage, sitemap status, GA4 organic sessions/users/views and
organic `retailer_offer_click` events. A local authorised session can run:

```text
npm run analytics:weekly
```

Optional historical end date:

```text
npm run analytics:weekly -- --end-date=2026-07-31
```

Output is confined to the ignored `tmp/growth-analytics` directory. API,
permission, credential or response failures stop the run. The script never
creates zero-filled evidence after a failed request.

Search Console does not expose the aggregate indexed/ excluded totals, Core Web
Vitals or Links reports through this supported API. The report labels those
limitations explicitly; they still require the Search Console interface, an export
or a separately reviewed data source.
