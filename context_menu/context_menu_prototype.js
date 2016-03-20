// -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
//
// Copyright (C) 2015 Opera Software ASA.  All rights reserved.
//
// This file is an original work developed by Opera Software ASA

'use strict';

class ContextMenuPrototype {
  constructor(clickedItem) {
    this.clickedItem_ = clickedItem;
    this.items = [];
    this.resolvedPromise_ = Promise.resolve();
    this.setup = this.setup.bind(this);
  }

  getItems() {
    return this.resolvedPromise_
        .then(this.setup)
        .then(function() {
          return this.items;
        }.bind(this));
  }

  addMenuItem(label, handler, options) {
    options || (options = {});
    this.items.push({
      'label': label,
      'handler': handler.bind(this),
      'isDisabled': options.isDisabled,
      'checked': options.checked,
    });
  }

  addSeparator() {
    this.items.push(ContextMenuPrototype.SEPARATOR);
  }
};

ContextMenuPrototype.SEPARATOR = {
  'separator': true
};
