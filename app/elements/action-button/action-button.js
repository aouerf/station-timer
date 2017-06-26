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
      label: {
        name: 'label',
        element: shadowRoot.querySelector('.label'),
      },
      icon: {
        name: 'icon',
        element: shadowRoot.querySelector('.icon'),
      },
    };
  }

  getAttributeValue(attributeName) {
    return this.hasAttribute(attributeName) ? this.getAttribute(attributeName) : '';
  }

  get label() {
    return this.getAttributeValue(this._components.label.name);
  }

  set label(label) {
    if (!label) {
      return;
    }

    this._components.label.element.textContent = label;
  }

  get icon() {
    return this.getAttributeValue(this._components.icon.name);
  }

  set icon(icon) {
    if (!icon) {
      return;
    }

    this._components.icon.element.setAttribute('d', icon);
  }

  // connectedCallback() {
  // }

  // disconnectedCallback() {
  // }

  attributeChangedCallback(attributeName, oldValue, newValue) {
    if (attributeName === this._components.label.name) {
      this.label = newValue;
    } else if (attributeName === this._components.icon.name) {
      this.icon = newValue;
    }
  }
}

window.customElements.define('action-button', ActionButton);
