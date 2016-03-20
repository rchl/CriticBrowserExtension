'use strict';

class HTMLContextMenuView {
  constructor() {
    this.isVisible_ = false;
    this.menuContainer_ = null;
    this.currentMenuActionHandler_ = null;
    this.onUiEventBound_ = this.onUiEvent_.bind(this);
    this.mousedownHandlerBound_ = this.mousedownHandler_.bind(this);
    this.clickHandlerBound_ = this.clickHandler_.bind(this);
  }

  showMenu(itemGenerator, menuActionHandler, x, y) {
    this.currentMenuActionHandler_ = menuActionHandler;
    let template = HTMLContextMenuView.Templates.menuContainer(itemGenerator);
    this.menuContainer_ = document.body.appendTemplate(template);
    let maxHeight = 0;
    let box = this.menuContainer_.getBoundingClientRect();

    // Check if the menu height fits within the window
    if (box.height + (HTMLContextMenuView.DEFAULT_MARGIN * 2) >
        window.innerHeight) {
      // It doesn't fit, apply max-height to make it scroll
      y = HTMLContextMenuView.DEFAULT_MARGIN;
      maxHeight =
          window.innerHeight - (HTMLContextMenuView.DEFAULT_MARGIN * 2) - 2;
      // 2 = border-width (top+bottom)
    } else if (y + box.height + HTMLContextMenuView.DEFAULT_MARGIN >
               window.innerHeight) {
      // Check if we can just flip it upwards
      if (box.height + HTMLContextMenuView.DEFAULT_MARGIN < y) {
        y -= box.height;
      } else {
        let overflow = window.innerHeight - y - box.height;
        y += overflow - HTMLContextMenuView.DEFAULT_MARGIN;
      }
    }

    // It doesn't fit to the right, flip it
    if (x + box.width + HTMLContextMenuView.DEFAULT_MARGIN >
        window.innerWidth) {
      x -= box.width;
    }
    // If went out of screen, align to left edge.
    x = Math.max(10, x);

    this.menuContainer_.style.cssText = [
      'left:' + x + 'px',
      'top:' + y + 'px',
      'max-height:' + (maxHeight ? maxHeight + 'px' : '100%'),
      'visibility:visible'
    ].join(';');

    this.isVisible_ = true;
    this.onShown_();
  }

  dismissMenu() {
    if (this.menuContainer_) {
      this.menuContainer_.remove();
      this.menuContainer_ = null;
    }
    this.isVisible_ = false;
    this.onHidden_();
  }

  onShown_() {
    document.addEventListener('mousedown', this.mousedownHandlerBound_, true);
    document.addEventListener('click', this.clickHandlerBound_, true);
    window.addEventListener('resize', this.onUiEventBound_, true);
    window.addEventListener('keydown', this.onUiEventBound_, true);
    window.addEventListener('blur', this.onUiEventBound_);
    // Prevent scrolling by mouse wheel when menu is visible
    window.onmousewheel = event => event.preventDefault();
  }

  onHidden_() {
    document.removeEventListener('mousedown', this.mousedownHandlerBound_,
                                 true);
    document.removeEventListener('click', this.clickHandlerBound_, true);
    window.removeEventListener('resize', this.onUiEventBound_, true);
    window.removeEventListener('keydown', this.onUiEventBound_, true);
    window.removeEventListener('blur', this.onUiEventBound_);
    window.onmousewheel = null;
  }

  onUiEvent_(event) {
    if (event.type === 'keydown' &&
        event.keyIdentifier !== HTMLContextMenuView.KEY_IDENTIFIER_ESCAPE) {
      return;
    }
    this.dismissMenu();
  }

  mousedownHandler_(event) {
    if (!this.isVisible_ || event.which != HTMLContextMenuView.LEFT_BUTTON) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
  }

  clickHandler_(event) {
    if (!this.isVisible_) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();

    let target = event.target;
    let handlerId;
    while (target != this.menuContainer_ && target != document) {
      handlerId = target.getAttribute('data-handler-id');
      if (handlerId) {
        break;
      }
      target = target.parentNode;
    }
    this.dismissMenu();
    this.currentMenuActionHandler_(handlerId || '');
  }
};

HTMLContextMenuView.Templates = class {
  static menuContainer(itemGenerator) {
    let itemTemplates = [];
    let itemTemplate;
    while (itemTemplate = itemGenerator.next().value) {
      itemTemplates.push(this.menuItem(itemTemplate));
    }
    return ['menu', {'id': 'contextmenu', 'class': 'menu'}, itemTemplates];
  }

  static menuItem(item) {
    if (item.type === 'separator') {
      return ['li', {'class': 'separator'}, ['hr']];
    }
    return [
      'li',
      {
        'data-handler-id': item.actionID,
        'class': item.isDisabled && 'disabled'
      },
      [
        'span',
        {
          'class':
              'menu-icon' + (item.isChecked ? ' check' :
                                              (item.isSelected ? ' radio' : ''))
        }
      ],
      ['span', item.name]
    ];
  }
};

HTMLContextMenuView.KEY_IDENTIFIER_ESCAPE = 'U+001B';
HTMLContextMenuView.LEFT_BUTTON = 1;
HTMLContextMenuView.DEFAULT_MARGIN = 2;
