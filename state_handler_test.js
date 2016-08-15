'use strict';

class TestBase {
  constructor() {
    this.stateHandler_ = new StateHandler();
    this.outputElement_ = document.querySelector('pre');
    this.log(`Running test: ${this.constructor.name}`);
    try {
      this.run();
      this.log('PASS');
    } catch (ex) {
      this.log(ex.stack);
    }
  }

  run() { console.error('Implement'); }

  log(text) {
    this.outputElement_.appendChild(document.createTextNode(`\n${text}`));
  }

  assert_eq(expected, actual, assertion) {
    if (expected !== actual) {
      this.log(
          `Assertion: ${assertion}\nExpected: ${expected}\nGot: ${actual}`);
      throw new Error();
    }
  }
}

class TestNoState extends TestBase {
  run() {
    let lastSeen = this.stateHandler_.getChangesFromLastCheck();
    this.assert_eq(3, Object.keys(lastSeen).length, 'Object has no keys');
    this.assert_eq(0, lastSeen['unread'].length, 'Unread array is empty');
    this.assert_eq(0, lastSeen['pending'].length, 'Pending array is empty');
    this.assert_eq(0, lastSeen['accepted'].length, 'Accepted array is empty');
    let lastCheck = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(3, Object.keys(lastCheck).length, 'Object has no keys');
    this.assert_eq(0, lastCheck['unread'].length, 'Unread array is empty');
    this.assert_eq(0, lastCheck['pending'].length, 'Pending array is empty');
    this.assert_eq(0, lastCheck['accepted'].length, 'Accepted array is empty');

    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastCheck(),
        'No new since last check');
    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastSeen(),
        'No new since last seen');

    this.stateHandler_.markAsLastCheckDone();
    lastCheck = this.stateHandler_.getChangesFromLastCheck();
    this.assert_eq(3, Object.keys(lastCheck).length, 'Object has no keys');
    this.assert_eq(0, lastCheck['unread'].length, 'Unread array is empty');
    this.assert_eq(0, lastCheck['pending'].length, 'Pending array is empty');
    this.assert_eq(0, lastCheck['accepted'].length, 'Accepted array is empty');

    this.stateHandler_.markAsSeen();
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(3, Object.keys(lastSeen).length, 'Object has no keys');
    this.assert_eq(0, lastSeen['unread'].length, 'Unread array is empty');
    this.assert_eq(0, lastSeen['pending'].length, 'Pending array is empty');
    this.assert_eq(0, lastSeen['accepted'].length, 'Accepted array is empty');

    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastCheck(),
        'No new since last check');
    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastSeen(),
        'No new since last seen');
  }
}

class TestAddState extends TestBase {
  run() {
    const state = {'unread': [100]};
    this.stateHandler_.updateState(state);
    this.assert_eq(
        true, this.stateHandler_.hasNewSinceLastCheck(),
        'Has changes since last check');
    this.assert_eq(
        true, this.stateHandler_.hasNewSinceLastSeen(),
        'Has changes since last seen');

    let lastSeen = this.stateHandler_.getChangesFromLastCheck();
    this.assert_eq(1, lastSeen['unread'].length, 'Unread array has one item');
    let lastCheck = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(1, lastCheck['unread'].length, 'Unread array has one item');

    this.stateHandler_.markAsLastCheckDone();
    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastCheck(),
        'Has no changes since last check');

    this.stateHandler_.markAsSeen();
    this.assert_eq(
        false, this.stateHandler_.hasNewSinceLastSeen(),
        'Has no changes since last seen');
  }
}

class TestMarkSeenState extends TestBase {
  run() {
    const reviewId1 = 100;
    const reviewId2 = 200;
    const reviewId3 = 300;
    let state = {'unread': [reviewId1, reviewId2]};
    this.stateHandler_.updateState(state);

    let lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(2, lastSeen['unread'].length, 'Unread array has items');
    this.assert_eq(reviewId1, lastSeen['unread'][0], 'Has review id');
    this.assert_eq(reviewId2, lastSeen['unread'][1], 'Has review id');

    state = {'unread': [reviewId2]};
    this.stateHandler_.updateState(state);
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(1, lastSeen['unread'].length, 'Unread array has items');
    this.assert_eq(reviewId2, lastSeen['unread'][0], 'Has review id');

    // Reset state to both reviews.
    state = {'unread': [reviewId1, reviewId2]};
    this.stateHandler_.updateState(state);
    // Mark review 1 as seen.
    this.stateHandler_.markUnreadAsSeen(reviewId1);
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(1, lastSeen['unread'].length, 'Unread array has items');
    this.assert_eq(reviewId2, lastSeen['unread'][0], 'Has review id');
    // Update state to only review 2.
    state = {'unread': [reviewId2]};
    this.stateHandler_.updateState(state);
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(1, lastSeen['unread'].length, 'Unread array is empty');
    this.assert_eq(reviewId2, lastSeen['unread'][0], 'Has review id');
    // Reset state to both reviews.
    state = {'unread': [reviewId1, reviewId2]};
    this.stateHandler_.updateState(state);
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(2, lastSeen['unread'].length, 'Unread array has items');

    this.stateHandler_.markAsSeen();
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(0, lastSeen['unread'].length, 'Unread array is empty');

    state = {'unread': [reviewId1, reviewId3]};
    this.stateHandler_.updateState(state);
    lastSeen = this.stateHandler_.getChangesFromLastSeen();
    this.assert_eq(1, lastSeen['unread'].length, 'Unread array has items');
    this.assert_eq(reviewId3, lastSeen['unread'][0], 'Has review id');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  [TestNoState, TestAddState, TestMarkSeenState].forEach(Test => new Test());
});
