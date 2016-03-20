// -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
//
// Copyright (C) 2016 Opera Software ASA.  All rights reserved.
//
// This file is an original work developed by Opera Software ASA

'use strict';

class ContextMenuManager {
  static createForRoot(root, options = {}) {
    if (!ContextMenuManager.menuView) {
      ContextMenuManager.menuView = new HTMLContextMenuView();
    }
    if (!ContextMenuManager.instances_.has(root)) {
      let instance =
          new ContextMenuManager(ContextMenuManager.instantiateKey_, root,
                                 ContextMenuManager.menuView, options);
      ContextMenuManager.instances_.set(root, instance);
    }
    return ContextMenuManager.instances_.get(root);
  }

  constructor(instantiateKey, root, viewController, options) {
    if (instantiateKey !== ContextMenuManager.instantiateKey_) {
      console.error('Use createForRoot() to create an instance.');
      return;
    }
    this.root_ = root;
    this.viewController_ = viewController;
    this.registeredMenus_ = {};
    this.currentItems_ = null;
    this.currentEvent_ = null;
    this.debuggingEnabled_ = options.debuggingEnabled;
    this.root_.addEventListener('contextmenu',
                                event => this.contextMenuHandler_(event));
  }

  register(menuId, callback) { this.registeredMenus_[menuId] = callback; }

  showMenu_(itemGenerator, menuActionHandler, x, y) {
    this.viewController_.dismissMenu();
    this.viewController_.showMenu(itemGenerator, menuActionHandler, x, y);
  }

  contextMenuHandler_(event) {
    if (this.debuggingEnabled_ && event.shiftKey) {
      event.stopPropagation();
      this.viewController_.dismissMenu();
      return;
    }
    event.stopPropagation();

    let element = event.target;
    let menuId = null;
    while (element && element !== this.root_) {
      if (this.shouldTriggerNativeContextMenu_(element)) {
        return;
      }
      menuId = element.dataset && element.dataset.menu;
      if (menuId) {
        break;
      }
      element = element.parentNode;
    }
    event.preventDefault();
    let menuCallback = this.registeredMenus_[menuId];
    if (menuCallback && typeof(menuCallback) === 'function') {
      Promise.resolve()
          .then(() => menuCallback(event, element))
          .then(menuItems => {
            if (menuItems && menuItems.length) {
              let itemGenerator =
                  this.itemGenerator_(menuItems, event, element);
              this.currentItems_ = menuItems;
              this.currentEvent_ = event;
              let menuActionHandler =
                  this.handleMenuAction_.bind(this, element);
              this.showMenu_(itemGenerator, menuActionHandler, event.clientX,
                             event.clientY);
            }
          });
    }
  }

  shouldTriggerNativeContextMenu_(element) {
    return element.matches('input, textarea') ||
           (element.dataset && element.dataset.nativeContextMenu);
  }

  * itemGenerator_(menuItems, event, element) {
    for (let i = 0, menuItem; menuItem = menuItems[i]; i++) {
      yield this.createItem_(event, element, menuItem, i);
    }
  }

  createItem_(event, element, item, index) {
    let createdItem = {type: 'default'};

    if (item.label) {
      createdItem.name = item.label;
    }

    if (typeof item.checked === 'boolean') {
      createdItem.type = 'checkbox';
      createdItem.isChecked = item.checked;
    } else if (typeof item.isDisabled === 'boolean') {
      createdItem.isDisabled = item.isDisabled;
    }

    if (item.separator) {
      createdItem.type = 'separator';
    } else {
      createdItem.actionID = String(index);
    }

    return createdItem;
  }

  handleMenuAction_(itemElement, actionID) {
    let item = this.currentItems_[actionID];
    if (item && !item.isDisabled && item.handler) {
      item.handler(this.currentEvent_, itemElement);
    }
    this.currentEvent_ = null;
    this.currentItems_ = null;
  }
}

ContextMenuManager.instantiateKey_ = Symbol();
ContextMenuManager.instances_ = new Map();
ContextMenuManager.menuView = null;
