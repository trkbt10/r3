/**
 * @file Audio bridge — decouples r3 widgets from the underlying SFX player.
 *
 * r3 widgets fire UI sound effects ("button hover", "button click", …)
 * but must not depend on Phaser (which is what currently owns the
 * `SfxPlayer` instance via its registry). The host wires a real
 * playback function in at boot via {@link bindR3SfxPlayer}; widgets
 * then call {@link playR3Sfx} without knowing whether Phaser, a
 * future direct AudioContext sink, or a test fake services the
 * request.
 *
 * The id space is intentionally `string` rather than the typed Phaser
 * `SfxEventId` union — r3 lives below the gameplay layer and should
 * not import from `audio/sfxEvents.ts` (which carries Phaser
 * coupling). Misnamed ids are silently dropped at the bound player
 * (matches the Phaser `playSfx` semantics).
 */

/** Concrete playback function the host installs. */
export type R3SfxPlayer = (id: string) => void;

/**
 * Module-state cache. Held inside an object so it can be mutated
 * without a top-level `let` — the lint config bans `let` outside
 * `for` loops, so we shape the state the same way as
 * {@link import("./Text.ts")}'s measurement-context cache.
 */
const sfxState: { player: R3SfxPlayer | null } = { player: null };

/**
 * Installs the playback function. The host typically calls this once
 * at boot (right after the Phaser SfxPlayer is registered) so every
 * subsequent r3 widget click finds a player waiting.
 */
export function bindR3SfxPlayer(player: R3SfxPlayer | null): void {
  sfxState.player = player;
}

/**
 * Fires a sound effect by id. No-op when no player is installed —
 * mirrors the host's existing `playSfx(scene, id)` which is also
 * silent when the player isn't in the registry yet (boot pre-asset).
 */
export function playR3Sfx(id: string): void {
  if (!sfxState.player) {
    return;
  }
  sfxState.player(id);
}
