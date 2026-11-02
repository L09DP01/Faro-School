import assert from 'node:assert/strict';
import {disposeBunnyPlayer} from '../src/lib/video/bunny-player-lifecycle';

const events = ['ready', 'timeupdate', 'pause', 'ended'];
const detached: string[] = [];
// Match Player.js: off removes the local callback, then sends to contentWindow.
// React removes the iframe before running passive cleanup on navigation.
const frame: {contentWindow: {postMessage(value: string): void} | null} = {contentWindow: null};
const handlers = new Set(events);
assert.doesNotThrow(() => disposeBunnyPlayer({off(event) {
  detached.push(event);
  handlers.delete(event);
  frame.contentWindow!.postMessage(event);
}}));
assert.deepEqual(detached, events);
assert.equal(handlers.size, 0, 'all handlers removed despite detached iframe');
const live: string[] = [];
assert.doesNotThrow(() => disposeBunnyPlayer({off(event) {live.push(event);}}));
assert.deepEqual(live, events);
assert.doesNotThrow(() => disposeBunnyPlayer({off() {throw new Error('already removed');}}));
console.log('PASS Bunny cleanup: detached iframe, all subscriptions and repeated disposal');
