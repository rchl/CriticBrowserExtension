'use strict';

class BackgroundPage {
  constructor() {
    // When adding new setting also add description in constants.js, if setting
    // is to be exposed.
    this.settings_ = {
      'username': '',
      'password': '',
      'notifications': true,
      'sslTunnel': true,
      'devLinks': false,
      'singleLine': false,
    };
    this.loggedIn_ = false;
    this.lastError_ = '';
    this.dashboardData_ = null;
    this.refreshTimeout_ = null;
    this.state_ = new class {
      constructor() {
        this.unread_ = [];
        this.lastSeenUnread_ = [];
        this.lastCheckUnread_ = [];
        this.pending_ = [];
        this.lastSeenPending_ = [];
        this.lastCheckPending_ = [];
        this.accepted_ = [];
        this.lastSeenAccepted_ = [];
        this.lastCheckAccepted_ = [];
      }

      getChangesFromLastCheck() {
        return {
          'unread': this.getNewItems_(this.lastCheckUnread_, this.unread_),
          'pending': this.getNewItems_(this.lastCheckPending_, this.pending_),
          'accepted':
              this.getNewItems_(this.lastCheckAccepted_, this.accepted_),
        };
      }

      getChangesFromLastSeen() {
        return {
          'unread': this.getNewItems_(this.lastSeenUnread_, this.unread_),
          'pending': this.getNewItems_(this.lastSeenPending_, this.pending_),
          'accepted': this.getNewItems_(this.lastSeenAccepted_, this.accepted_),
        };
      }

      hasNewSinceLastCheck() {
        return this.getNewItems_(this.lastCheckUnread_, this.unread_).length ||
               this.getNewItems_(this.lastCheckPending_, this.pending_)
                   .length ||
               this.getNewItems_(this.lastCheckAccepted_, this.accepted_)
                   .length;
      }

      hasNewSinceLastSeen() {
        return this.getNewItems_(this.lastSeenUnread_, this.unread_).length ||
               this.getNewItems_(this.lastSeenPending_, this.pending_).length ||
               this.getNewItems_(this.lastSeenAccepted_, this.accepted_).length;
      }

      getNewItems_(oldArray, newArray) {
        return newArray.filter(item => oldArray.indexOf(item) === -1);
      }

      markAsLastCheckDone() {
        this.lastCheckUnread_ = this.unread_;
        this.lastCheckPending_ = this.pending_;
        this.lastCheckAccepted_ = this.accepted_;
      }

      markAsSeen() {
        this.lastSeenUnread_ = this.unread_;
        this.lastSeenPending_ = this.pending_;
        this.lastSeenAccepted_ = this.accepted_;
      }

      markUnreadAsSeen(reviewId) { this.lastSeenUnread_.push(reviewId); }

      markPendingAsSeen(reviewId) { this.lastSeenPending_.push(reviewId); }

      markAcceptedAsSeen(reviewId) { this.lastSeenAccepted_.push(reviewId); }
    };
    this.notificationsUrlMap_ = new Map();
    chrome.notifications.onClicked.addListener(
        id => this.onNotificationClicked_(id));
    this.ready_ = this.init_();
  }

  ready() { return this.ready_; }

  get settings() { return this.settings_; }

  get data() { return this.dashboardData_; }

  get state() { return this.state_; }

  /**
   * Whether in logged in state.
   *
   * Logged in state doesn't guarantee that there is valid data available. It
   * only indicates that login credentials are saved.
   */
  get loggedIn() { return this.loggedIn_; }

  /**
   * Whether last check resulted in an error.
   *
   * No data is available in error state. Can be set either in logged in or out
   * state.
   */
  get lastError() { return this.lastError_; }

  init_() {
    return this.readSettings_().then(() => {
      this.loggedIn_ = this.settings_.username && this.settings_.password;
      if (this.loggedIn_) {
        return this.refreshData_();
      }
    });
  }

  attemptLogIn(username, password, useSslTunnel) {
    this.settings_.username = username;
    this.settings_.password = password;
    this.settings_.sslTunnel = useSslTunnel;
    return this.getDashboardData_()
        .then(() => {
          if (!this.lastError_) {
            this.saveSettings_();
            this.scheduleNextCheck_();
          }
        });
  }

  getDashboardData_() {
    return this.request(`User/${this.settings_.username}/Dashboard`)
        .then(data => {
          if (this.lastError_) {
            this.onRefreshError_();
          } else {
            this.loggedIn_ = true;
            this.dashboardData_ = data;
            this.processData_();
          }
        });
  }

  refreshData_() {
    return this.getDashboardData_().then(() => this.scheduleNextCheck_());
  }

  // TODO(rchlodnicki): Pass array originally.
  arrayFromObject(objectIn) {
    let output = [];
    for (let id in objectIn) {
      output.push(id);
    }
    return output;
  }

  processData_() {
    let changesCount = this.dashboardData_.active.hasPendingChanges.length;
    changesCount += this.dashboardData_.active.hasUnreadComments.length;
    let acceptedArray =
        this.arrayFromObject(this.dashboardData_.owned.accepted);
    changesCount += acceptedArray.length;
    this.state_.pending_ = this.dashboardData_.active.hasPendingChanges;
    this.state_.unread_ = this.dashboardData_.active.hasUnreadComments;
    this.state_.accepted_ = acceptedArray;
    chrome.browserAction.setBadgeText(
        {'text': changesCount ? String(changesCount) : ''});
    if (changesCount > 0) {
      this.updateBadgeColor_();
      if (this.settings_.notifications) {
        this.triggerNotifications_();
      }
    }
    this.state_.markAsLastCheckDone();
  }

  onRefreshError_() {
    this.dashboardData_ = null;
    chrome.browserAction.setBadgeText({'text': ''});
  }

  scheduleNextCheck_() {
    window.clearTimeout(this.refreshTimeout_);
    this.refreshTimeout_ =
        setTimeout(() => this.refreshData_(), Constants.REFRESH_INTERVAL);
  }

  saveSettings_() {
    chrome.storage.local.set(this.settings_);
  }

  resetReadStatus() {
    this.state_.markAsSeen();
    if (this.loggedIn_ && !this.lastError_) {
      this.processData_();
    }
  }

  setSetting(name, value) {
    this.settings_[name] = value;
    this.saveSettings_();
  }

  openReviewUrl(reviewId) { this.openUrl_(this.reviewUrl_(reviewId)); }

  openPendingChangesUrl(reviewId) {
    this.openUrl_(this.pendingChangesUrl_(reviewId));
  }

  openUnreadCommentsUrl(reviewId) {
    this.openUrl_(this.unreadCommentsUrl_(reviewId));
    // Opening unread URL marks them as read so trigger update shortly after
    // opening to make the state match.
    setTimeout(() => this.refreshData_(), 3000);
  }

  openOpenIssuesUrl(reviewId) {
    let url = this.baseUrl_() + 'showcomments?review=' + reviewId +
              '&filter=open-issues';
    this.openUrl_(url);
  }

  reviewUrl_(reviewId) { return this.baseUrl_() + 'r/' + reviewId; }

  pendingChangesUrl_(reviewId) {
    return this.baseUrl_() + 'showcommit?review=' + reviewId +
           '&filter=pending';
  }

  unreadCommentsUrl_(reviewId) {
    return this.baseUrl_() + 'showcomments?review=' + reviewId +
           '&filter=toread';
  }

  openUrl_(url) {
    chrome.tabs.query({url}, tabs => {
      if (tabs.length) {
        chrome.tabs.update(tabs[0].id, {'url': url, 'active': true});
      } else {
        chrome.tabs.create({url});
      }
    });
  }

  baseUrl_() {
    return this.settings_.sslTunnel ?
               Constants.CRITIC_SSL_TUNNEL_BASE_URL :
               this.settings_.devLinks ? Constants.CRITIC_DEV_BASE_URL :
                                         Constants.CRITIC_BASE_URL;
  }

  updateBadgeColor_() {
    chrome.browserAction.setBadgeBackgroundColor({
      'color': this.state_.hasNewSinceLastSeen() ?
                   Constants.BADGE_COLOR_ACTIVE :
                   Constants.BADGE_COLOR_INACTIVE
    });
  }

  triggerNotifications_() {
    if (this.state_.hasNewSinceLastCheck()) {
      let changes = this.state_.getChangesFromLastCheck();
      if (changes.pending.length) {
        for (let id of changes.pending) {
          let review = this.dashboardData_.all[id];
          chrome.notifications.create(
              undefined,
              {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'New changes',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_LINES,
              }));
        }
      }
      if (changes.unread.length) {
        for (let id of changes.unread) {
          let review = this.dashboardData_.all[id];
          let unreadCount = this.dashboardData_.active.unreadComments[id];
          chrome.notifications.create(
              undefined,
              {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'Unread comments (' + unreadCount + ')',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_COMMENTS,
              }));
        }
      }
      if (changes.accepted.length) {
        for (let id of changes.accepted) {
          let review = this.dashboardData_.owned.accepted[id];
          chrome.notifications.create(
              undefined,
              {
                'type': 'basic',
                'iconUrl': 'images/128.png',
                'title': 'Accepted',
                'message': review.summary,
                'isClickable': true,
              },
              id => this.notificationsUrlMap_.set(id, {
                'reviewId': review.id,
                'type': BackgroundPage.NOTIFICATION_TYPE_REVIEW,
              }));
        }
      }
    }
  }

  onNotificationClicked_(notificationId) {
    let data = this.notificationsUrlMap_.get(notificationId);
    this.notificationsUrlMap_.delete(notificationId);
    let url;
    switch (data.type) {
      case BackgroundPage.NOTIFICATION_TYPE_LINES:
        url = this.pendingChangesUrl_(data.reviewId);
        this.state_.markPendingAsSeen(data.reviewId);
        break;
      case BackgroundPage.NOTIFICATION_TYPE_COMMENTS:
        url = this.unreadCommentsUrl_(data.reviewId);
        this.state_.markUnreadAsSeen(data.reviewId);
        break;
      case BackgroundPage.NOTIFICATION_TYPE_REVIEW:
        url = this.reviewUrl_(data.reviewId);
        this.state_.markAcceptedAsSeen(data.reviewId);
        break;
      default:
        console.error('Unhandled type!');
    }
    this.updateBadgeColor_();
    chrome.tabs.create({url});
    chrome.windows.update(chrome.windows.WINDOW_ID_CURRENT, {'focused': true});
  }

  readSettings_() {
    return new Promise(resolve => {
      chrome.storage.local.get(this.settings_, values => {
        for (let name in values) {
          this.settings_[name] = values[name];
        }
        resolve();
      });
    });
  }

  logOut() {
    this.settings_.username = '';
    this.settings_.password = '';
    this.loggedIn_ = false;
    this.saveSettings_();
    this.onRefreshError_();
  }

  request(path) {
    let headers = new Headers();
    headers.append(
        'Authorization',
        'Basic ' +
            window.btoa(unescape(encodeURIComponent(
                this.settings_.username + ':' + this.settings_.password))));
    return window.fetch(this.baseUrl_() + 'JSON/' + path, {headers})
        .then(response => {
          if (!response.ok) {
            this.lastError_ = response.statusText;
            return null;
          }
          this.lastError_ = '';
          return response.json();
        }, error => this.lastError_ = error.message);
  }
};

BackgroundPage.NOTIFICATION_TYPE_COMMENTS = 0;
BackgroundPage.NOTIFICATION_TYPE_LINES = 1;
BackgroundPage.NOTIFICATION_TYPE_REVIEW = 2;

window.background = new BackgroundPage();
