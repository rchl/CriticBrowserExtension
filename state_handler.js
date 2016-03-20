'use strict';

class StateHandler {
  constructor() {
    // Latest state as seen during last update check.
    this.current_ = this.getSealedDefaultObject_();
    // State last seen by the user.
    this.lastSeen_ = this.getSealedDefaultObject_();
    // State between previous and latest check.
    this.lastCheck_ = this.getSealedDefaultObject_();
  }

  getSealedDefaultObject_() {
    return Object.seal({'unread': [], 'pending': [], 'accepted': []});
  }

  updateState(stateObject) {
    for (let key of Object.keys(stateObject)) {
      console.assert(this.current_.hasOwnProperty(key));
      this.current_[key] = stateObject[key];
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

  /**
   * Returns the differences between key values in provided objects.
   *
   * Returned object contains the same keys as both input objects filled
   * with values that only existing in the newObject.
   *
   * @param  {Object} oldObject The object to compare with.
   * @param  {Object} newObject The object to compare with.
   *
   * @return {Object} The object with changed values.
   */
  getObjectChanges_(oldObject, newObject) {
    let changes = this.getSealedDefaultObject_();
    for (let key of Object.keys(changes)) {
      console.assert(oldObject.hasOwnProperty(key));
      console.assert(newObject.hasOwnProperty(key));
      changes[key] =
          newObject[key].filter(item => oldObject[key].indexOf(item) === -1);
    }
    return changes;
  }

  markAsLastCheckDone() { this.lastCheck_ = this.current_; }

  markAsSeen() { this.lastSeen_ = this.current_; }

  markUnreadAsSeen(reviewId) { this.lastSeen_['unread'].push(reviewId); }

  markPendingAsSeen(reviewId) { this.lastSeen_['pending'].push(reviewId); }

  markAcceptedAsSeen(reviewId) { this.lastSeen_['accepted'].push(reviewId); }
};
