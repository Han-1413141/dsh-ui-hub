/**
 * Host half of dsh-ui-hub.
 *
 * The web profile keeps every `dsh.client` package mounted as a loaded entry on
 * the host cordis tree, because the node half of dsh-client-modules discovers
 * browser plugins by scanning exactly those entries (a plugin that never loads
 * on the host is invisible to the scan). This package has no host-side
 * behavior, so the host plugin is an inert marker that makes the entry real;
 * everything observable lives in the browser half (`./client`, lib/client.js).
 */

/** Stable Cordis plugin name. */
export const name = "ui-hub";

/**
 * Inert marker apply: activating this entry is the whole host-side contract.
 * @param _ctx - host root context (unused).
 */
export function apply(_ctx) {}
