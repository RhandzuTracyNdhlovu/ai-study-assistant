# Workers AI neuron planning

Model: `@cf/baai/bge-base-en-v1.5`.

Cloudflare's current model pricing lists 6,058 neurons per million input tokens for this model, while the Free Workers plan includes 10,000 neurons per day. This implies a theoretical ceiling of about 1.65 million input tokens per day before any other account usage.

The current chunk set averages about 202 words per chunk including overlap. At a rough 1.3 tokens per word, that is about 262 tokens per chunk and approximately 6,300 average-sized chunks per 10,000-neuron day. This is a planning estimate, not a measured result. The actual daily capacity must use the Cloudflare dashboard's neuron delta for the 10-chunk request:

`chunks per day = floor(10,000 * 10 / neurons used by the 10-chunk request)`

Subtract any other Workers AI usage from the daily allowance. Cloudflare says the daily limits reset at 00:00 UTC. The dashboard before/after values and live request are still required to report the measured neuron cost and final capacity.
