'use strict';

class ReviewContextMenu extends ContextMenuPrototype {
  constructor(clickedItem, backgroundPage) {
    super(clickedItem);
    this.backgroundPage_ = backgroundPage;
  }

  setup() {
    let owners = this.clickedItem_.dataset.owners.split('|');
    for (let owner of owners) {
      this.addMenuItem(
          `Show reviews by: ${owner}`, () => this.showOwnerReviews_(owner));
    }
  }

  showOwnerReviews_(owner) {
    this.backgroundPage_.openOwnerReviewsUrl(owner);
  }
};
