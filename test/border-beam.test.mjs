import test from 'node:test';
import assert from 'node:assert/strict';

// A constructor-contract harness: style writes become real host attributes,
// and observers remain live until explicitly disconnected. Browser coverage
// also runs in AIStudio with the packed public border-beam subpath.
class Element {
  attributes = new Map();
  children = [];
  classList = new Set();
  part = new Set();
  styles = new Map();
  style = {
    setProperty: (key, value) => { this.styles.set(key, value); this.setAttribute('style', 'present'); },
    removeProperty: key => this.styles.delete(key),
  };
  attachShadow() { return this.shadowRoot = new Element(); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) {
    const previous = this.getAttribute(name); this.attributes.set(name, value);
    if (this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, previous, value);
  }
  removeAttribute(name) {
    const previous = this.getAttribute(name); this.attributes.delete(name);
    if (this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, previous, null);
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.classList.has(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  getBoundingClientRect() { return { width: 200, height: 100 }; }
}
globalThis.HTMLElement = Element;
globalThis.document = { createElement: () => new Element(), createElementNS: () => new Element() };
globalThis.getComputedStyle = () => ({ borderTopLeftRadius: '10px' });
const observers = new Set();
globalThis.ResizeObserver = class {
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
};
const { HYBorderBeam } = await import('../dist/border-beam.js');

test('border beam construction leaves host attributes empty, then configures and releases connected effects', () => {
  const beam = new HYBorderBeam();
  assert.equal(beam.attributes.size, 0, 'createElement rejects custom-element constructors that add host attributes');
  assert.equal(observers.size, 0);
  beam.connectedCallback(); beam.connectedCallback();
  assert.equal(observers.size, 1, 'connection owns exactly one observer');
  assert.ok(beam.styles.has('--_beam-glow'), 'default appearance is applied at connection');
  beam.thickness = 3; beam.speed = 2; beam.count = 2; beam.color = '#ffaa00';
  const beams = beam.shadowRoot.querySelectorAll('.beam');
  assert.equal(beams.length, 2);
  assert.equal(beams[0].getAttribute('stroke-width'), '3');
  assert.equal(beams[0].style.animationDuration, '3s');
  assert.equal(beams[1].style.animationDelay, '-1.5s');
  assert.equal(beam.styles.get('--_beam-color'), '#ffaa00');
  beam.disconnectedCallback(); beam.disconnectedCallback();
  assert.equal(observers.size, 0);
  beam.connectedCallback();
  assert.equal(observers.size, 1);
  assert.equal(beam.shadowRoot.querySelectorAll('.beam').length, 2);
  beam.disconnectedCallback();
  assert.equal(observers.size, 0);
});
