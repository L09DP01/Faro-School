/** React may detach the iframe before passive effect cleanup runs. Player.js
 * sends postMessage during off(), and its contentWindow can then be null.
 * Cleanup must release every subscription without breaking route navigation.
 */
export function disposeBunnyPlayer(player: {off(event: string): unknown}): void {
  for (const event of ['ready', 'timeupdate', 'pause', 'ended']) {
    try {
      player.off(event);
    } catch {
      // An already detached third-party iframe cannot receive the unsubscribe.
    }
  }
}
