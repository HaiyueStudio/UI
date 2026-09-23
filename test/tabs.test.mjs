import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = 0;
    const tokens = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => tokens.add(name)),
      has: name => tokens.has(name),
      toggle: (name, force) => {
        if (force === false || (force === undefined && tokens.has(name))) {
          tokens.delete(name);
          return false;
        }
        tokens.add(name);
        return true;
      },
    };
  }

  attachShadow() {
    this.shadowRoot = new Element('#shadow-root');
    this.shadowRoot.host = this;
    return this.shadowRoot;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    const next = String(value);
    if (name === 'id') this.id = next;
    this.attributes.set(name, next);
    if (this.constructor.observedAttributes?.includes(name)) {
      this.attributeChangedCallback?.(name, null, next);
    }
  }

  getAttribute(name) {
    if (name === 'id' && this.id) return this.id;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return name === 'id' ? Boolean(this.id) : this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
  }

  addEventListener() {}

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      for (const child of node.children) {
        if (child.tagName === selector) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  focus() {
    let current = this.parentNode;
    while (current?.parentNode) current = current.parentNode;
    if (current) current.activeElement = this;
  }
}

globalThis.HTMLElement = Element;
globalThis.document = { createElement: tag => new Element(tag) };

const { HYTabs } = await import('../dist/tabs.js');

test('tabs keep per-instance panel ids and normalize disabled selections', () => {
  const first = new HYTabs();
  first.options = [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }];
  first.value = 'one';
  first.connectedCallback();

  const second = new HYTabs();
  second.options = [{ label: 'Alpha', value: 'alpha' }, { label: 'Beta', value: 'beta' }];
  second.value = 'alpha';
  second.connectedCallback();

  const firstButtons = first.shadowRoot.children[1].children;
  const secondButtons = second.shadowRoot.children[1].children;
  const firstPanels = first.shadowRoot.children[2].children;
  const secondPanels = second.shadowRoot.children[2].children;
  assert.notEqual(firstButtons[0].id, secondButtons[0].id);
  assert.notEqual(firstPanels[0].id, secondPanels[0].id);
  assert.equal(firstButtons[0].getAttribute('aria-controls'), firstPanels[0].id);
  assert.equal(firstPanels[0].getAttribute('aria-labelledby'), firstButtons[0].id);

  const normalized = new HYTabs();
  normalized.options = [
    { label: 'Disabled', value: 'disabled', disabled: true },
    { label: 'Enabled', value: 'enabled' },
  ];
  normalized.value = 'disabled';
  normalized.connectedCallback();

  const normalizedButtons = normalized.shadowRoot.children[1].children;
  const normalizedPanels = normalized.shadowRoot.children[2].children;
  assert.equal(normalized.getAttribute('value'), 'enabled');
  assert.equal(normalizedButtons[0].getAttribute('aria-selected'), 'false');
  assert.equal(normalizedButtons[1].getAttribute('aria-selected'), 'true');
  assert.equal(normalizedPanels[0].hidden, true);
  assert.equal(normalizedPanels[1].hidden, false);
  assert.equal(normalizedButtons[1].getAttribute('aria-controls'), normalizedPanels[1].id);

  const allDisabled = new HYTabs();
  allDisabled.options = [
    { label: 'Disabled A', value: 'a', disabled: true },
    { label: 'Disabled B', value: 'b', disabled: true },
  ];
  allDisabled.value = 'a';
  allDisabled.connectedCallback();

  const allDisabledButtons = allDisabled.shadowRoot.children[1].children;
  assert.equal(allDisabled.getAttribute('value'), '');
  assert.equal(allDisabledButtons[0].getAttribute('aria-selected'), 'false');
  assert.equal(allDisabledButtons[1].getAttribute('aria-selected'), 'false');
});
