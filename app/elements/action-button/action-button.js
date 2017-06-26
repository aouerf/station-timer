/* eslint-disable no-underscore-dangle */

class ActionButton extends HTMLElement {

  static get observedAttributes() {
    return ['label', 'icon'];
  }

  constructor() {
    super();

    const ownerDocument = document.currentScript.ownerDocument;
    const template = ownerDocument.querySelector('#action-button-template');
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.appendChild(template.content.cloneNode(true));

    this._components = {
      container: shadowRoot.querySelector('.container'),
      button: shadowRoot.querySelector('.button'),
      label: shadowRoot.querySelector('.label'),
      icon: shadowRoot.querySelector('.icon'),
    };
  }

  getAttributeValue(attributeName) {
    return this.hasAttribute(attributeName) ? this.getAttribute(attributeName) : '';
  }

  get label() {
    return this.getAttributeValue(this._components.label.className);
  }

  set label(label) {
    if (!label) {
      return;
    }

    this._components.label.textContent = label;
  }

  get icon() {
    return this.getAttributeValue(this._components.icon.className);
  }

  set icon(icon) {
    if (!icon) {
      return;
    }

    this._components.icon.setAttribute('d', icon);
  }

  connectedCallback() {
    // Action is a noop function by default
    this.setAction(() => {});
  }

  disconnectedCallback() {
    // Remove action from element on callback
    this.removeAction();
  }

  attributeChangedCallback(attributeName, oldValue, newValue) {
    if (attributeName === this._components.label.className) {
      this.label = newValue;
    // Must check with baseVal property for icon because the className is a SVGAnimatedString object
    } else if (attributeName === this._components.icon.className.baseVal) {
      this.icon = newValue;
    }
  }

  setAction(action) {
    if (typeof action !== 'function') {
      return;
    }

    // Remove the current action and replace it with the new one
    this.removeAction();
    this._action = action;
    this._components.button.addEventListener('click', this._action);
  }

  removeAction() {
    this._components.button.removeEventListener('click', this._action);
  }

  hideButton() {
    this.setHidden(true);
  }

  showButton() {
    this.setHidden(false);
  }

  setHidden(hidden) {
    if (typeof hidden !== 'boolean') {
      return;
    }

    this._components.container.style.display = hidden ? 'none' : '';
  }
}

window.customElements.define('action-button', ActionButton);
