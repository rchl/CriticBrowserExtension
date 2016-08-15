'use strict';

class StateHandler {
  static get KEY_UNREAD() { return 'unread'; }
  static get KEY_PENDING() { return 'pending'; }
  static get KEY_ACCEPTED() { return 'accepted'; }

  static get KEYS() {
    return [this.KEY_UNREAD, this.KEY_PENDING, this.KEY_ACCEPTED];
  }

  constructor() {
    // Latest state as seen during last update check.
    this.current_ = this.getSealedDefaultObject_();
    // State last seen by the user.
    this.lastSeen_ = this.getSealedDefaultObject_();
    // State between previous and latest check.
    this.lastCheck_ = this.getSealedDefaultObject_();
  }

  updateState(stateObject) {
    const oldCurrent = this.getSealedDefaultObject_();
    this.copyObject_(this.current_, oldCurrent);
    for (let KEY of StateHandler.KEYS) {
      if (stateObject.hasOwnProperty(KEY)) {
        this.current_[KEY] = stateObject[KEY];
      }
    }
    // Remove all IDs from other objects that were removed from current so
    // that we are properly notified of changes when same ID re-appears.
    const removed = this.getObjectChanges_(this.current_, oldCurrent);
    for (let KEY of StateHandler.KEYS) {
      this.lastSeen_[KEY] =
          this.lastSeen_[KEY].filter(id => removed[KEY].indexOf(id) === -1);
      this.lastCheck_[KEY] =
          this.lastCheck_[KEY].filter(id => removed[KEY].indexOf(id) === -1);
    }
  }

  getChangesFromLastCheck() {
    return this.getObjectChanges_(this.lastCheck_, this.current_);
  }

  getChangesFromLastSeen() {
    return this.getObjectChanges_(this.lastSeen_, this.current_);
  }

  hasNewSinceLastCheck() {
    let changes = this.getChangesFromLastCheck();
    return Object.keys(changes).some(key => changes[key].length);
  }

  hasNewSinceLastSeen() {
    let changes = this.getChangesFromLastSeen();
    return Object.keys(changes).some(key => changes[key].length);
  }

  markAsLastCheckDone() { this.copyObject_(this.current_, this.lastCheck_); }

  markAsSeen() { this.copyObject_(this.current_, this.lastSeen_); }

  markUnreadAsSeen(reviewId) {
    this.lastSeen_[StateHandler.KEY_UNREAD].push(reviewId);
  }

  markPendingAsSeen(reviewId) {
    this.lastSeen_[StateHandler.KEY_PENDING].push(reviewId);
  }

  markAcceptedAsSeen(reviewId) {
    this.lastSeen_[StateHandler.KEY_ACCEPTED].push(reviewId);
  }

  getSealedDefaultObject_() {
    return Object.seal({
      [StateHandler.KEY_UNREAD]: [],
      [StateHandler.KEY_PENDING]: [],
      [StateHandler.KEY_ACCEPTED]: []
    });
  }

  /**
   * Returns the differences between key values in provided objects.
   *
   * Returned object contains the same keys as both input objects, filled
   * with values that exist only in the newObject.
   *
   * @param  {Object} oldObject The object to compare with.
   * @param  {Object} newObject The object to compare with.
   *
   * @return {Object} The object with changed values.
   */
  getObjectChanges_(oldObject, newObject) {
    let changes = this.getSealedDefaultObject_();
    for (let KEY of StateHandler.KEYS) {
      console.assert(oldObject.hasOwnProperty(KEY));
      console.assert(newObject.hasOwnProperty(KEY));
      changes[KEY] =
          newObject[KEY].filter(item => oldObject[KEY].indexOf(item) === -1);
    }
    return changes;
  }

  copyObject_(source, target) {
    for (let KEY of StateHandler.KEYS) {
      target[KEY] = source[KEY].slice();
    }
  }
}
